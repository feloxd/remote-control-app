// Native system-wide keyboard blocker for Windows.
//
// Installs a WH_KEYBOARD_LL low-level keyboard hook that swallows EVERY key
// event before it reaches any application. A low-level hook callback runs on
// the thread that installed the hook, and that thread MUST pump a Win32
// message loop for the callback to be dispatched. Electron's main thread runs
// libuv's event loop, not a Win32 message pump, so we install the hook on a
// dedicated worker thread that runs GetMessage()/DispatchMessage().
//
// Exposes two functions to JS:
//   startBlock() -> bool   engage the block (true if the hook installed)
//   stopBlock()  -> bool   release the block
//
// Ctrl+Alt+Del cannot be intercepted by an LL hook (the kernel owns the secure
// attention sequence); it stays as an escape hatch alongside the JS failsafe.

#include <napi.h>
#include <windows.h>
#include <thread>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <cstring>

namespace {

HHOOK g_hook = NULL;
std::thread g_thread;
DWORD g_threadId = 0;
std::atomic<bool> g_active(false);

// Handshake so startBlock() can report whether SetWindowsHookEx succeeded.
std::mutex g_mtx;
std::condition_variable g_cv;
bool g_ready = false;
bool g_hookOk = false;
bool g_cursorHidden = false;

const DWORD kSystemCursorIds[] = {
  32512,  // OCR_NORMAL
  32513,  // OCR_IBEAM
  32514,  // OCR_WAIT
  32515,  // OCR_CROSS
  32516,  // OCR_UP
  32642,  // OCR_SIZENWSE
  32643,  // OCR_SIZENESW
  32644,  // OCR_SIZEWE
  32645,  // OCR_SIZENS
  32646,  // OCR_SIZEALL
  32648,  // OCR_NO
  32649,  // OCR_HAND
  32650,  // OCR_APPSTARTING
};

HCURSOR CreateBlankCursor() {
  constexpr int kCursorSize = 32;
  constexpr int kMaskBytes = (kCursorSize * kCursorSize) / 8;
  BYTE andMask[kMaskBytes];
  BYTE xorMask[kMaskBytes];
  memset(andMask, 0xFF, sizeof(andMask));
  memset(xorMask, 0x00, sizeof(xorMask));
  return CreateCursor(GetModuleHandle(NULL), 0, 0, kCursorSize, kCursorSize,
                      andMask, xorMask);
}

LRESULT CALLBACK LowLevelKeyboardProc(int nCode, WPARAM wParam, LPARAM lParam) {
  if (nCode >= 0 && g_active.load()) {
    // Returning a non-zero value swallows the event: it never reaches the
    // focused window or any later hook in the chain.
    return 1;
  }
  return CallNextHookEx(NULL, nCode, wParam, lParam);
}

void HookThread() {
  g_threadId = GetCurrentThreadId();
  g_hook = SetWindowsHookEx(WH_KEYBOARD_LL, LowLevelKeyboardProc,
                            GetModuleHandle(NULL), 0);
  {
    std::lock_guard<std::mutex> lk(g_mtx);
    g_hookOk = (g_hook != NULL);
    g_ready = true;
  }
  g_cv.notify_one();

  if (g_hook == NULL) {
    g_active.store(false);
    return;
  }

  // Pump messages so the LL hook callback gets dispatched on this thread.
  // The loop exits when stopBlock() posts WM_QUIT to this thread.
  MSG msg;
  while (GetMessage(&msg, NULL, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessage(&msg);
  }

  if (g_hook != NULL) {
    UnhookWindowsHookEx(g_hook);
    g_hook = NULL;
  }
}

Napi::Value StartBlock(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (g_active.load()) {
    return Napi::Boolean::New(env, true);  // already engaged
  }

  g_active.store(true);
  {
    std::lock_guard<std::mutex> lk(g_mtx);
    g_ready = false;
    g_hookOk = false;
  }

  g_thread = std::thread(HookThread);

  // Wait until the worker thread reports whether the hook installed.
  bool ok;
  {
    std::unique_lock<std::mutex> lk(g_mtx);
    g_cv.wait(lk, [] { return g_ready; });
    ok = g_hookOk;
  }

  if (!ok) {
    g_active.store(false);
    if (g_thread.joinable()) g_thread.join();
    g_threadId = 0;
  }

  return Napi::Boolean::New(env, ok);
}

Napi::Value StopBlock(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!g_active.load()) {
    return Napi::Boolean::New(env, true);  // nothing engaged
  }

  // Stop swallowing immediately, then tear the hook thread down.
  g_active.store(false);
  if (g_threadId != 0) {
    PostThreadMessage(g_threadId, WM_QUIT, 0, 0);
  }
  if (g_thread.joinable()) {
    g_thread.join();
  }
  g_threadId = 0;

  return Napi::Boolean::New(env, true);
}

Napi::Value HideSystemCursor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_cursorHidden) return Napi::Boolean::New(env, true);

  for (DWORD cursorId : kSystemCursorIds) {
    HCURSOR blank = CreateBlankCursor();
    if (blank == NULL || !SetSystemCursor(blank, cursorId)) {
      if (blank != NULL) DestroyCursor(blank);
      SystemParametersInfo(SPI_SETCURSORS, 0, NULL, 0);
      return Napi::Boolean::New(env, false);
    }
  }

  g_cursorHidden = true;
  return Napi::Boolean::New(env, true);
}

Napi::Value RestoreSystemCursor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  const BOOL ok = SystemParametersInfo(
    SPI_SETCURSORS, 0, NULL, SPIF_SENDCHANGE | SPIF_UPDATEINIFILE);
  g_cursorHidden = false;
  return Napi::Boolean::New(env, ok == TRUE);
}

}  // namespace

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("startBlock", Napi::Function::New(env, StartBlock));
  exports.Set("stopBlock", Napi::Function::New(env, StopBlock));
  exports.Set("hideSystemCursor", Napi::Function::New(env, HideSystemCursor));
  exports.Set("restoreSystemCursor", Napi::Function::New(env, RestoreSystemCursor));
  return exports;
}

NODE_API_MODULE(keyboard_hook, Init)
