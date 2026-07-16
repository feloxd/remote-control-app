const ACTIONS = Object.freeze({
  open_url: 'open_url',
  show_image: 'show_image',
  close_image: 'close_image',
  play_video: 'play_video',
  close_video: 'close_video',
  play_audio: 'play_audio',
  stop_audio: 'stop_audio',
  show_overlay: 'show_overlay',
  hide_overlay: 'hide_overlay',
  lock_keyboard: 'lock_keyboard',
  unlock_keyboard: 'unlock_keyboard',
  lock_screen: 'lock_screen',
  unlock_screen: 'unlock_screen',
  take_screenshot: 'take_screenshot',
  filter_sites: 'filter_sites',
  clear_filters: 'clear_filters',
  pixelate_screen: 'pixelate_screen',
  censor_screen: 'censor_screen',
  show_text: 'show_text',
  blackout_screen: 'blackout_screen',
  hide_cursor: 'hide_cursor',
});

export { ACTIONS };
export default ACTIONS;
