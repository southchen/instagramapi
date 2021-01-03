'use strict';

const SINCE_KEY = 'since';
const urlParams = new URLSearchParams(window.location.search);
const sinceParam = urlParams.get(SINCE_KEY);
if (sinceParam) {
  sessionStorage.setItem(SINCE_KEY, sinceParam);
} else {
  sessionStorage.removeItem(SINCE_KEY);
}

// Global variables
const YEAR = sessionStorage.getItem(SINCE_KEY)
  ? sessionStorage.getItem(SINCE_KEY)
  : 2020;
const DOMAIN = `https://southchen.github.io/instagramapi/`;
const CANVAS_SIZES = [4, 9, 16, 25];
const DEFAULT_SIZE = 9;
const ACTIVE_CLASS = 'active';
const HASH = window.location.search.substr(1).split('=');
const API_CLIENT_ID = '971107313427781';
const API_BASE = 'https://api.instagram.com/';
const GRAPH_API_BASE = 'https://graph.instagram.com/';
const LOGIN_URL = `${API_BASE}oauth/authorize/?client_id=${API_CLIENT_ID}&redirect_uri=${DOMAIN}&response_type=code&scope=user_profile,user_media`;
const ACCESS_TOEKN_URL = `${API_BASE}oauth/access_token`;
var ACCESS_TOKEN = '';
const CLIENT_ID = '971107313427781';
const CLIENT_SECRET = '108b7b79451a08421c199ffbe80b9980';
// Set the initial view and render the app
window.onload = () => {
  if (HASH[0] === 'code') {
    getAccessToken(HASH[1]);
    history.replaceState('', document.title, DOMAIN);
    return true;
  }

  return renderView('home', callbackHome);
};

// The rest of the app
const renderView = (view, callback) => {
  Array.from(document.querySelectorAll('.view')).forEach((el) =>
    hideElement(el)
  );
  showElement(document.getElementById(view));

  if (callback) {
    callback();
  }
};

const callbackHome = () => {
  Array.from(document.querySelectorAll('.js-login')).forEach((btn) => {
    btn.setAttribute('href', LOGIN_URL);
    btn.addEventListener('click', () => renderView('loading'));
  });
};

const callbackPics = () => {
  document.getElementById('js-message').innerHTML =
    'Hold tight, this could take a minute...';
  fetchMedia().then(createCollages).then(displayCollages).catch(displayError);
};

const getAccessToken = (code) => {
  let formData = new FormData();
  formData.append('code', code);

  return fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_url: DOMAIN,
    }),
  })
    .then((response) => {
      console.log(response);
      response.json();
    })
    .then(({ status, data }) => {
      ACCESS_TOKEN = data.token.access_token;
      renderView('loading', callbackPics);
    })
    .catch(displayError);
};

const fetchMedia = () => {
  const API_ENDPOINT = `${GRAPH_API_BASE}me/media/?fields=fields=id,media_type,media_url,permalink,thumbnail_url,timestamp,username&access_token=${ACCESS_TOKEN}`;
  return new Promise((resolve, reject) => {
    getPostsFromYear(API_ENDPOINT, YEAR).then((response) => resolve(response));
  });
};

const createCollages = (media) => {
  const imagePromises = [];

  CANVAS_SIZES.forEach((canvasSize) => {
    const gutterWidth = 2;
    let canvas = document.getElementById(`js-canvas--${canvasSize}`);
    const context = canvas.getContext('2d');
    const gridNum = Math.sqrt(canvasSize);
    // const numLikes = media.slice(0, canvasSize).reduce((total, item) => (total += 1), 0)
    const imageWidth = Math.floor(750 / gridNum);
    const canvasWidth = imageWidth * gridNum + (gridNum - 1) * gutterWidth;

    canvas.width = canvasWidth;
    canvas.height = canvas.width;
    context.fillStyle = '#ffffff';
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < canvasSize; i++) {
      const item = media[i];
      if (typeof item === 'undefined') {
        continue;
      }
      const col = i % gridNum;
      const row = Math.floor(i / gridNum);
      const posX = imageWidth * col + gutterWidth * col;
      const posY = imageWidth * row + gutterWidth * row;
      imagePromises.push(
        addMedia(context, item.media_url, posX, posY, imageWidth)
      );
    }
  });

  return new Promise((resolve, reject) => {
    Promise.all(imagePromises).then((responses) => {
      resolve(true);
    });
  });
};

const displayCollages = () => {
  addDataURLs();
  updateCollageSrc(
    document.getElementById(`js-canvas--${DEFAULT_SIZE}`).dataset.url
  );
  document
    .getElementById(`js-tab--${DEFAULT_SIZE}`)
    .classList.add(ACTIVE_CLASS);
  enableTabs();
  updateDownloadLinks(DEFAULT_SIZE);
  renderView('pics');
};

const getPostsFromYear = (endpoint, year, media = []) => {
  return fetch(endpoint)
    .then((response) => response.json())
    .then(({ data, paging }) => {
      const lastMediaYear = getMediaYear(data[data.length - 1].timestamp);
      const moreResults = paging.next && lastMediaYear > year - 1;
      const newMedia = data.filter(
        (media) => getMediaYear(media.timestamp) === year
      );

      const updatedMedia = media
        .concat(newMedia)
        // .sort((a, b) => b.likes.count - a.likes.count || b.comments.count - a.comments.count)
        .splice(0, 25);
      if (moreResults) {
        return getPostsFromYear(paging.next, year, updatedMedia);
      }

      return updatedMedia;
    })
    .catch(displayError);
};

const addDataURLs = () => {
  Array.from(document.querySelectorAll('.js-canvas')).forEach((canvas) => {
    canvas.dataset['url'] = canvas
      .toDataURL('image/jpeg', 0.8)
      .replace('image/jpeg', 'image/octet-stream');
  });
};

const updateCollageSrc = (src) => {
  document.getElementById('js-collage').src = src;
};

const updateTabs = (activeId) => {
  document.querySelector('.js-tab.active').classList.remove(ACTIVE_CLASS);
  document.getElementById(activeId).classList.add(ACTIVE_CLASS);
};

const enableTabs = () => {
  document.querySelector('.js-tabs').addEventListener('click', (event) => {
    if (event.target.matches('.js-tab')) {
      updateTabs(event.target.id);
      updateCollageSrc(
        document.getElementById(`js-canvas--${event.target.dataset.pics}`)
          .dataset.url
      );
      updateDownloadLinks(event.target.dataset.pics);
    }
  });
};

const addMedia = (ctx, url, posX, posY, w) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const crop = Math.min(image.width, image.height);
      ctx.drawImage(
        image,
        image.width / 2 - crop / 2,
        image.height / 2 - crop / 2,
        crop,
        crop,
        posX,
        posY,
        w,
        w
      );
      return resolve(image);
    };
    image.src = url;
  });
};

const getMediaYear = (date) => new Date(date).getFullYear();

const updateDownloadLinks = (num) => {
  Array.from(document.querySelectorAll('.js-download')).forEach((el) => {
    el.href = document.getElementById(`js-canvas--${num}`).dataset.url;
    el.download = `MyTop${num}of${YEAR}.jpg`;
  });
};

const hideElement = (view) => {
  view.setAttribute('hidden', 'hidden');
};

const showElement = (view) => {
  view.removeAttribute('hidden');
};

const displayError = (error) => {
  renderView('error', (error) => {
    document.getElementById('js-error').innerHTML = error;
  });
  console.error(error);
};
