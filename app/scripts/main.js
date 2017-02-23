/* jshint ignore: start */
//--- Script from original ISS feed ---//

var D = document, W = window,
  vimeo, vimeo_player, ustream, ustream_player, wrapper, map, bounds, marker = false,
  vimeo_iframe = '<iframe src="http://player.vimeo.com/video/95002726?html5ui=1&autoplay=true&badge=0&byline=0&color=000000&loop=1&portrait=0&title=0&api=1&player_id=vimeo&hd=1" id="vimeo"></iframe>',
  ustream_ids = [
    '17074538', // http://www.ustream.tv/channel/iss-hdev-payload
    '9408562' // http://www.ustream.tv/channel/live-iss-stream
  ],
  h = window.location.hash.substr(1),
  ustream_id = (h && h.length > 0) ? h : ustream_ids[0];
  window.location.hash = ustream_id;
  // ustream_iframe = '<iframe src="http://www.ustream.tv/embed/17074538?v=3&autoplay=true&locale=en_US&autoResize=true&enablejsapi=true&quality=best&volume=0.01" id="ustream"></iframe>';

$(function(){
  wrapper = $$("wrapper");
  init();
});


// Switch feed and reload on click:
$('switch').on('click', function(e){
  e.preventDefault();
  var isHdev = ustream_id === ustream_ids[0];
  ustream_id = isHdev ? ustream_ids[1] : ustream_ids[0];
  window.location.hash = ustream_id;
  document.location.reload(false);
});

function init() {

  var ustream_iframe = '<iframe src="http://www.ustream.tv/embed/'+ustream_id+'?v=3&html5ui=1&autoplay=true&locale=en_US&autoResize=true&enablejsapi=true&quality=best&volume=0" id="ustream"></iframe>';
  wrapper.innerHTML = ustream_iframe;
  ustream = $$('ustream');
  ustream_player = UstreamEmbed('ustream');
  ustream_player.addListener('live', live);
  ustream_player.addListener('offline', offline);
  ustream_player.callMethod('quality', 16);

  if (window.location.search.substr(1) === 'map') {
    initMap();

    setInterval(function(){
      // ajax('http://sobolev.us/download/nasa/iss.php?'+Math.random()*1E18,function(str){
      ajax('https://api.wheretheiss.at/v1/satellites/25544',function(str){
        var json = eval("(function(){return " + str + ";})()");
        updateMarker(json);
      });
    },5555);
  } else {
    $$('map').remove();
  }

}

function offline() {
  R("vimeo");
  wrapper.innerHTML += vimeo_iframe;
  ustream.className = 'hide';
  vimeo = $$("vimeo");
  vimeo_player = $f(vimeo);
  vimeo_player.addEvent('ready',function(){
    vimeo_player.api('setVolume', 0);
  });

  log('Offline');
}
function live() {
  ustream_player.callMethod('play');
  log('Live');
}
function playing() {
  log('Playing');
}

function R(id){
  var n = G(id);
  n.parentElement.removeChild(n);
};
function $$(id) {
  return D.getElementById(id);
};

function ajax(url, callback) {
  var x, d = 0, callback = callback || function(){};
  if (W.XDomainRequest) {
    x = new XDomainRequest();
    x.onerror = function() {};
    x.onprogress = function() {};
    x.onload = callback(x.responseText);
    x.open("GET", url);
    x.send();
  } else {
    x = new XMLHttpRequest();
    x.onreadystatechange = function() {
      if (x.readyState == 4 && x.status == 200) callback(x.responseText);
    }
    x.open("GET", url, true);
    x.send();
  }
}

function initMap() {
  var settings = {
      zoom: 1,
      scrollwheel: false,
      navigationControl: false,
      scaleControl: false,
      streetViewControl: false,
      draggable: false,
      mapTypeControl: false,
      panControl: false,
      zoomControl: false,
      zoomControlOptions: { style: google.maps.ZoomControlStyle.SMALL },
      mapTypeId: google.maps.MapTypeId.ROADMAP
    },
    style = [{"featureType":"water","elementType":"geometry","stylers":[{"color":"#193341"}]},{"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#2c5a71"}]},{"featureType":"road","elementType":"geometry","stylers":[{"color":"#29768a"},{"lightness":-37}]},{"featureType":"poi","elementType":"geometry","stylers":[{"color":"#406d80"}]},{"featureType":"transit","elementType":"geometry","stylers":[{"color":"#406d80"}]},{"elementType":"labels.text.stroke","stylers":[{"visibility":"on"},{"color":"#3e606f"},{"weight":2},{"gamma":0.84}]},{"elementType":"labels.text.fill","stylers":[{"color":"#ffffff"}]},{"featureType":"administrative","elementType":"geometry","stylers":[{"weight":0.6},{"color":"#1a3541"}]},{"elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#2c5a71"}]}];

  map = new google.maps.Map($$("map"), settings);

  map.setOptions({styles: style});
  nite.init(map);
};

function addMarker(location) {
  var latlng = new google.maps.LatLng(location.latitude, location.longitude);
  image = {
    url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAABNElEQVR4AVWRMWvCUBSFj9HXpyYhIhEnB0Ww7dBfII5CJ4cW2qUdHF7BXZAiCC0VOtlf0cWpk5N/oquLHZxtt069Pe01kJwjJHnnu+/ivcgod3CiTJSHgUWRtjD88tKgx6MSoqA2aT+fNOuowMcRIUX4MDyI38/FqTeDfgMhEU+BPKvj7QWjO5nJXEbi9rfDFgIU9A6D6L/6XrYi1KcsxH1cogpLgD8b1ITVjBN9y1jctMObPQIoTtoEZpLWq7hVF/4BmB8TeMoAS3HrXgLYZp3ASL4k0Y88iJufokyAMqhsBkQW7K3xm7jdFWIOLad/0+839jdExuy9lEe+uZczhDAKeBxJOGz9TUK9u2YcwTJJ9kAkQHXaWXXXPfaOETLWUStCtsCjEny6zN4muyyFiKnTK/8Fwa2dfmyRmmYAAAAASUVORK5CYII=',
    anchor: new google.maps.Point(0, 8)
  },
  marker = new google.maps.Marker({
    position: latlng,
    map: map,
    icon: image
  });
}

function updateMarker(location) {
  if (typeof location === 'undefined') return;
  if (!marker) addMarker(location);
  log('updating to: '+location.latitude+','+location.longitude);
  var latlng = new google.maps.LatLng(location.latitude, location.longitude);
  marker.setPosition(latlng);
  map.setCenter(latlng);
  nite.refresh();
}

function log(e){
  try{ console.log(e); } catch(e){}
}

/* jshint ignore: end */
