(() => {
  'use strict';

  // NASA restarts these streams occasionally, which changes the video ID.
  // If a feed dies, grab the new ID from https://www.youtube.com/@NASA/streams
  const FEEDS = {
    earth: { videoId: 'ROboUHfPUrU', switchLabel: 'Switch to crew view' },
    crew: { videoId: 'M3HKLzjvKPc', switchLabel: 'Switch to Earth view' },
  };
  // Old Ustream channel IDs, so bookmarks from the original site still work
  const LEGACY_HASHES = { 17074538: 'earth', 9408562: 'crew' };
  const FALLBACK_SRC = 'https://player.vimeo.com/video/95002726?background=1';

  const wrapper = document.getElementById('wrapper');
  const switchButton = document.getElementById('switch');
  let feed = feedFromHash();
  let player;
  let fallback;

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
      videoId: FEEDS[feed].videoId,
      playerVars: {
        autoplay: 1,
        mute: 1, // Browsers block autoplay with sound
        controls: 0,
        disablekb: 1,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3,
      },
      events: {
        onReady: (e) => {
          e.target.mute();
          e.target.playVideo();
        },
        onError: showFallback,
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) showFallback();
        },
      },
    });
  };

  const api = document.createElement('script');
  api.src = 'https://www.youtube.com/iframe_api';
  api.onerror = showFallback; // e.g. blocked by an ad blocker
  document.head.appendChild(api);

  switchButton.addEventListener('click', () => {
    setFeed(feed === 'earth' ? 'crew' : 'earth');
    // If the YouTube API never loaded, the fallback is all we can show
    if (!player?.loadVideoById) return;
    hideFallback();
    player.loadVideoById(FEEDS[feed].videoId);
  });

  setFeed(feed);

  function feedFromHash() {
    const hash = window.location.hash.slice(1);
    return FEEDS[hash] ? hash : LEGACY_HASHES[hash] || 'earth';
  }

  function setFeed(key) {
    feed = key;
    history.replaceState(null, '', '#' + key);
    switchButton.textContent = FEEDS[key].switchLabel;
  }

  function showFallback() {
    if (fallback) return;
    console.warn(`ISS feed "${feed}" unavailable, falling back to recorded footage`);
    fallback = document.createElement('iframe');
    fallback.src = FALLBACK_SRC;
    fallback.allow = 'autoplay; fullscreen';
    fallback.className = 'fallback';
    wrapper.appendChild(fallback);
  }

  function hideFallback() {
    if (!fallback) return;
    fallback.remove();
    fallback = null;
  }
})();
