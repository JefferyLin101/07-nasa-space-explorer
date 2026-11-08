// =========================================================
// Settings
// =========================================================

// NASA's APOD feed. APOD moved to science.nasa.gov in September 2026,
// and this is its new data feed. It doesn't need an API key.
// (The old api.nasa.gov/planetary/apod address now sends back the
// NASA logo and the title "NASA Science" for every date.)
const APOD_FEED_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';

// How many days of pictures to show at once
const DAYS_TO_SHOW = 9;

// =========================================================
// Find the elements on the page
// =========================================================

// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

const getImagesButton = document.getElementById('getImagesBtn');
const gallery = document.getElementById('gallery');
const factText = document.getElementById('factText');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalCloseButton = document.getElementById('modalClose');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);

// =========================================================
// LevelUp: random "Did You Know?" space fact
// =========================================================

const spaceFacts = [
  'A day on Venus (243 Earth days) is longer than a year on Venus (225 Earth days).',
  'Saturn is less dense than water. In a big enough bathtub, it would float.',
  'Sunlight takes about 8 minutes and 20 seconds to reach Earth.',
  'The International Space Station circles Earth about every 90 minutes, so astronauts see around 16 sunrises a day.',
  "Jupiter's Great Red Spot is a storm wider than the entire Earth.",
  'About 1.3 million Earths could fit inside the Sun.',
  'The footprints left on the Moon could last for millions of years, because there is no wind or rain to erase them.',
  'Olympus Mons on Mars is about two and a half times taller than Mount Everest.',
  'The Moon drifts about 3.8 centimeters (1.5 inches) farther from Earth every year.',
  'Venus is the hottest planet in our solar system, even though Mercury is closer to the Sun.',
  'Uranus is tipped on its side, so it rolls around the Sun like a ball.',
  'Winds on Neptune can blow faster than 1,200 miles per hour (2,000 km/h).',
  'Voyager 1, launched in 1977, is the most distant human-made object in space.',
  'The Hubble Space Telescope has been orbiting Earth since 1990.',
  "NASA's Astronomy Picture of the Day has posted a new image every day since June 16, 1995."
];

function showRandomFact() {
  const randomIndex = Math.floor(Math.random() * spaceFacts.length);
  factText.textContent = spaceFacts[randomIndex];
}

// =========================================================
// Date helpers
// =========================================================

// Adds (or subtracts) days from a 'YYYY-MM-DD' date and returns a new 'YYYY-MM-DD' date
function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

// Makes a list of every date from start to end, like ['2026-07-22', '2026-07-23', ...]
function listDates(range) {
  const dates = [];
  for (let date = range.start; date <= range.end; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

// APOD posts new pictures on US Eastern time, so "today" for APOD
// can be different from "today" on your computer (especially at night)
function getLatestApodDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year').value;
  const month = parts.find((part) => part.type === 'month').value;
  const day = parts.find((part) => part.type === 'day').value;
  return `${year}-${month}-${day}`;
}

// Turns '2026-11-04' into 'November 4, 2026'
function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Turns '2026-11-04' into '261104' (the date format NASA's feed uses)
function toShortDate(dateString) {
  return dateString.slice(2).replaceAll('-', '');
}

// Reads the date pickers and makes sure we ask NASA for exactly 9 valid days
function getDateRange() {
  const latestDate = getLatestApodDate();
  let start = startInput.value;
  let end = endInput.value;

  // If one of the boxes is empty, fall back to the most recent 9 days
  if (!start || !end) {
    end = latestDate;
    start = addDays(end, -(DAYS_TO_SHOW - 1));
  }

  // If the dates are backwards, swap them
  if (start > end) {
    [start, end] = [end, start];
  }

  // Don't ask for a day before the first APOD
  // (earliestDate comes from dateRange.js)
  if (start < earliestDate) {
    start = earliestDate;
  }

  // Always use 9 days: count 9 days forward from the start date...
  end = addDays(start, DAYS_TO_SHOW - 1);

  // ...but if that runs past the newest picture, slide the range back
  if (end > latestDate) {
    end = latestDate;
    start = addDays(end, -(DAYS_TO_SHOW - 1));
  }

  // Show the dates we're actually using in the date pickers
  startInput.value = start;
  endInput.value = end;

  return { start, end };
}

// =========================================================
// Cleaning up the data from NASA
// =========================================================

// NASA's feed sends some text as HTML (like "<a>" tags and "&amp;").
// This turns it into plain text and tidies up extra spaces.
function plainText(value) {
  if (!value) {
    return '';
  }
  // Some feeds wrap text like { rendered: '...' }
  if (typeof value === 'object') {
    value = value.rendered || '';
  }
  const doc = new DOMParser().parseFromString(String(value), 'text/html');
  return doc.body.textContent.replace(/\s+/g, ' ').trim();
}

// Puts every entry from NASA into the same simple shape
function cleanEntry(entry) {
  // In the new feed, "url" is the entry's NASA page and "hdurl" is the picture.
  // For videos, "hdurl" is a still frame from the video.
  const pageUrl = entry.permalink || entry.url || 'https://science.nasa.gov/apod/';

  // Look for a video link in the entry's HTML (or its url)
  const searchText = `${entry.url || ''} ${entry.basic_html || ''}`;
  const embedUrl = getEmbedUrl(searchText);
  const videoFileUrl = findVideoFile(searchText);
  const isVideo = entry.media_type === 'video' || Boolean(embedUrl) || Boolean(videoFileUrl);

  return {
    date: (entry.date || '').slice(0, 10),
    title: plainText(entry.title) || 'Untitled',
    explanation: plainText(entry.explanation),
    credit: plainText(entry.credit) || plainText(entry.copyright),
    alt: plainText(entry.alt),
    isVideo: isVideo,
    imageUrl: entry.hdurl || getYouTubeThumbnail(searchText),
    pageUrl: pageUrl,
    embedUrl: embedUrl,
    videoFileUrl: videoFileUrl
  };
}

// =========================================================
// LevelUp: video helpers
// =========================================================

// Finds a YouTube video ID in some text (or returns '' if there isn't one)
function getYouTubeId(text) {
  const match = (text || '').match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : '';
}

function getYouTubeThumbnail(text) {
  const id = getYouTubeId(text);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

// Returns a link that can go inside an <iframe>, or '' if there's no YouTube/Vimeo video
function getEmbedUrl(text) {
  const youTubeId = getYouTubeId(text);
  if (youTubeId) {
    return `https://www.youtube.com/embed/${youTubeId}?rel=0`;
  }
  const vimeoMatch = (text || '').match(/player\.vimeo\.com\/video\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return '';
}

// Finds a link to a plain video file (.mp4, .webm, .mov), or returns ''
function findVideoFile(text) {
  const match = (text || '').match(/https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)/i);
  return match ? match[0] : '';
}

// =========================================================
// Getting data from NASA
// =========================================================

// Asks the feed for every entry in the date range at once
async function fetchDateRange(range) {
  const url = `${APOD_FEED_URL}?date_from=${toShortDate(range.start)}&date_to=${toShortDate(range.end)}&per_page=25`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`APOD feed returned status ${response.status}`);
  }

  const data = await response.json();
  const list = Array.isArray(data) ? data : (data.items || data.results || []);

  // Clean up each entry, and only keep the ones inside our date range
  return list
    .map(cleanEntry)
    .filter((entry) => entry.date >= range.start && entry.date <= range.end);
}

// Asks the feed for one day (used to fill in any days that are missing)
async function fetchOneDay(date) {
  const response = await fetch(`${APOD_FEED_URL}/${toShortDate(date)}`);
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  const entry = cleanEntry(Array.isArray(data) ? data[0] || {} : data);
  return entry.date === date ? entry : null;
}

// Gets all 9 days of entries
async function getApodEntries(range) {
  let entries = [];

  // 1. Try getting the whole range in one request
  try {
    entries = await fetchDateRange(range);
  } catch (error) {
    console.warn(error.message);
  }

  // 2. If any days are missing, ask for those days one by one
  const datesWeHave = entries.map((entry) => entry.date);
  const missingDates = listDates(range).filter((date) => !datesWeHave.includes(date));
  if (missingDates.length > 0) {
    const extraEntries = await Promise.all(
      missingDates.map((date) => fetchOneDay(date).catch(() => null))
    );
    entries = entries.concat(extraEntries.filter(Boolean));
  }

  // 3. If today's picture isn't posted yet, add the day before the range
  //    so there are still 9 pictures
  if (entries.length < DAYS_TO_SHOW && range.end === getLatestApodDate()) {
    const dayBefore = addDays(range.start, -1);
    const extraEntry = await fetchOneDay(dayBefore).catch(() => null);
    if (extraEntry) {
      entries.push(extraEntry);
      startInput.value = dayBefore;
    }
  }

  return entries;
}

// =========================================================
// Building the gallery
// =========================================================

// Small helper to make an element with a class and some text
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text) {
    element.textContent = text;
  }
  return element;
}

// A dark tile with an icon, used when there's no picture to show
function createFallbackTile(icon, label) {
  const tile = createElement('span', 'media-fallback');
  tile.append(createElement('span', 'media-fallback-icon', icon));
  tile.append(createElement('span', '', label));
  return tile;
}

// Shows a message in the gallery (used for loading, errors and empty results)
function showMessage(icon, text, extraClass) {
  gallery.innerHTML = '';
  const box = createElement('div', `placeholder ${extraClass || ''}`);
  box.append(createElement('div', 'placeholder-icon', icon));
  box.append(createElement('p', '', text));
  gallery.append(box);
}

// Builds one gallery card
function createGalleryItem(entry) {
  // A button, so it can be clicked or opened with the keyboard
  const item = createElement('button', 'gallery-item');
  item.type = 'button';
  item.setAttribute('aria-label', `${entry.title}, ${formatDate(entry.date)}. Open details.`);

  const frame = createElement('span', 'media-frame');

  if (entry.imageUrl) {
    const img = document.createElement('img');
    img.src = entry.imageUrl;
    img.alt = entry.alt || entry.title;
    img.loading = 'lazy';
    // If the picture fails to load, show a tile instead of a broken image
    img.addEventListener('error', () => {
      img.replaceWith(createFallbackTile(entry.isVideo ? '▶' : '🌌', entry.isVideo ? 'Watch video' : 'View entry'));
    });
    frame.append(img);
  } else if (entry.isVideo) {
    frame.append(createFallbackTile('▶', 'Watch video'));
  } else {
    frame.append(createFallbackTile('🌌', 'View entry'));
  }

  // Label video entries so people know what they'll get
  if (entry.isVideo) {
    frame.append(createElement('span', 'media-badge', '▶ Video'));
  }

  const text = createElement('span', 'card-text');
  text.append(createElement('span', 'card-date', formatDate(entry.date)));
  text.append(createElement('span', 'card-title', entry.title));

  item.append(frame, text);
  item.addEventListener('click', () => openModal(entry));
  return item;
}

// Replaces whatever is in the gallery with the new cards
function displayGallery(entries) {
  gallery.innerHTML = '';
  entries.forEach((entry) => {
    gallery.append(createGalleryItem(entry));
  });
}

// Runs when you click "Get Space Images"
async function loadGallery() {
  const range = getDateRange();

  // Show the loading message while we wait for NASA
  showMessage('🔄', 'Loading space photos…', 'loading');
  getImagesButton.disabled = true;
  getImagesButton.textContent = 'Loading…';

  try {
    const entries = await getApodEntries(range);

    // Newest first
    entries.sort((a, b) => b.date.localeCompare(a.date));

    if (entries.length === 0) {
      showMessage('🌑', "We couldn't get any space photos for those dates. Please try again, or pick a different range.", 'placeholder-error');
    } else {
      displayGallery(entries); // this also removes the loading message
    }
  } catch (error) {
    console.error(error);
    showMessage('⚠️', "We couldn't reach NASA right now. Please wait a minute and try again.", 'placeholder-error');
  } finally {
    getImagesButton.disabled = false;
    getImagesButton.textContent = 'Get Space Images';
  }
}

// =========================================================
// Modal
// =========================================================

// Builds the image or video at the top of the modal
function createModalMedia(entry) {
  const media = createElement('div', 'modal-media');

  if (entry.isVideo && entry.embedUrl) {
    // YouTube or Vimeo: embed the player
    const wrapper = createElement('div', 'video-wrapper');
    const iframe = document.createElement('iframe');
    iframe.src = entry.embedUrl;
    iframe.title = entry.title;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    wrapper.append(iframe);
    media.append(wrapper);
  } else if (entry.isVideo && entry.videoFileUrl) {
    // A plain video file: use the browser's video player
    const video = document.createElement('video');
    video.src = entry.videoFileUrl;
    video.controls = true;
    if (entry.imageUrl) {
      video.poster = entry.imageUrl;
    }
    media.append(video);
  } else if (entry.imageUrl) {
    // The full-size picture (or the video's still frame)
    const img = document.createElement('img');
    img.src = entry.imageUrl;
    img.alt = entry.alt || entry.title;
    media.append(img);
  } else {
    media.append(createFallbackTile(entry.isVideo ? '▶' : '🌌', entry.isVideo ? 'Video' : 'View on NASA\'s site'));
  }

  return media;
}

function openModal(entry) {
  modalBody.innerHTML = '';
  modalBody.append(createModalMedia(entry));

  const details = createElement('div', 'modal-details');
  details.append(createElement('p', 'modal-date', formatDate(entry.date)));

  const title = createElement('h2', 'modal-title', entry.title);
  title.id = 'modalTitle';
  details.append(title);

  details.append(createElement('p', 'modal-explanation', entry.explanation));

  if (entry.credit) {
    details.append(createElement('p', 'modal-credit', `Credit: ${entry.credit}`));
  }

  // Link to the entry's NASA page. If a video can't play here, that page plays it.
  const videoPlaysHere = entry.embedUrl || entry.videoFileUrl;
  const linkText = entry.isVideo && !videoPlaysHere
    ? '▶ Watch the video on NASA\'s site ↗'
    : 'View on NASA\'s APOD site ↗';
  const link = createElement('a', 'modal-link', linkText);
  link.href = entry.pageUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  details.append(link);

  modalBody.append(details);
  modal.showModal();
  modal.scrollTop = 0;
}

function closeModal() {
  modal.close();
}

// Empty the modal when it closes, so any video stops playing
modal.addEventListener('close', () => {
  modalBody.innerHTML = '';
});

modalCloseButton.addEventListener('click', closeModal);

// Clicking the dark area outside the box also closes the modal
// (the Escape key closes it automatically)
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

// =========================================================
// Start the app
// =========================================================

getImagesButton.addEventListener('click', loadGallery);
showRandomFact();