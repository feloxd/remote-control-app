{
  "targets": [
    {
      "target_name": "keyboard_hook",
      "sources": [ "keyboard-hook.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [ "NAPI_VERSION=8" ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "conditions": [
        [ "OS=='win'", {
          "libraries": [ "user32.lib" ],
          "defines": [ "_HAS_EXCEPTIONS=1" ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": [ "/std:c++17" ]
            }
          }
        } ]
      ]
    }
  ]
}
