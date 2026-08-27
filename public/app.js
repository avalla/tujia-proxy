'use strict';

const $ = (id) => document.getElementById(id);
const CNY_TO_EUR = 0.13; // mirrors CONFIG.CNY_TO_EUR

let catalog = null;
let allStations = []; // flattened, for the filter box

/** The landmark distances are currently measured from. Null for a city with none. */
const currentLandmark = () =>
  catalog?.city.landmarks.find((l) => l.key === $('landmark').value) ||
  catalog?.city.landmarks[0] ||
  null;

/**
 * Pagination state. `body` is frozen at the moment of the search so "Load more"
 * keeps using the query that produced the current results, even if the user has
 * since fiddled with the form. `seen` guards against Tujia occasionally repeating
 * a listing across pages as its live ranking drifts.
 */
let paging = { body: null, nextPageIndex: null, seen: new Set(), loading: false };

/* ── boot ─────────────────────────────────────────────────────────── */

async function boot() {
  populateGuests();
  updateNights();
  updatePriceHint();

  $('checkIn').addEventListener('change', updateNights);
  $('checkOut').addEventListener('change', updateNights);
  $('priceMin').addEventListener('input', updatePriceHint);
  $('priceMax').addEventListener('input', updatePriceHint);
  $('station-filter').addEventListener('input', renderStations);
  $('metroStation').addEventListener('change', () => {
    if ($('metroStation').value) $('metroLine').value = ''; // station is the narrower ask
    syncLocationHint();
  });
  $('metroLine').addEventListener('change', () => {
    if ($('metroLine').value) {
      $('metroStation').value = '';
      $('station-filter').value = '';
      renderStations();
    }
    syncLocationHint();
  });
  $('search-form').addEventListener('submit', onSubmit);
  $('landmark').addEventListener('change', syncLandmark);
  // Every city has its own metro network, districts and filter vocabulary, so
  // switching one reloads the whole catalog rather than filtering what is loaded.
  $('city').addEventListener('change', () => loadCatalog($('city').value));

  await loadCatalog();
}

/**
 * Fetch and render one city's catalog. Called on boot with no argument (the server
 * picks the default city) and again on every city change.
 */
async function loadCatalog(cityId) {
  $('catalog-note').textContent = 'Loading catalog…';
  try {
    const res = await fetch('/api/v1/filters' + (cityId ? `?city=${encodeURIComponent(cityId)}` : ''));
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'HTTP ' + res.status);
    catalog = body;
  } catch (err) {
    $('catalog-note').textContent = 'Could not load filter catalog: ' + err.message;
    return;
  }

  allStations = catalog.metroLines.flatMap((line) =>
    line.stations.map((s) => ({ ...s, line: line.en }))
  );

  renderCities();
  renderLines();
  renderStations();
  renderSorts();
  renderAmenities();
  renderLandmarks();
  syncLocationHint();

  const when = new Date(catalog.generatedAt);
  const filterCount = catalog.amenityGroups.reduce((n, g) => n + g.items.length, 0);
  $('catalog-note').textContent = allStations.length
    ? `${allStations.length} stations · ${filterCount} filters · catalog from ${when.toLocaleDateString('en-GB')}`
    : `${filterCount} filters · no metro in ${catalog.city.name} · catalog from ${when.toLocaleDateString('en-GB')}`;
}

/* ── form population ──────────────────────────────────────────────── */

function populateGuests() {
  const sel = $('guestCount');
  for (let n = 1; n <= 15; n++) {
    const o = document.createElement('option');
    o.value = String(n);
    o.textContent = n === 1 ? '1 guest' : `${n} guests`;
    if (n === 2) o.selected = true;
    sel.appendChild(o);
  }
}

/** The city picker. Only cities with a generated catalog are offered. */
function renderCities() {
  const sel = $('city');
  sel.textContent = '';
  for (const c of catalog.cities) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = `${c.name} · ${c.nameCn}`;
    if (c.id === catalog.city.id) o.selected = true;
    sel.appendChild(o);
  }
  $('city-hint').textContent = `Searching ${catalog.city.name}. Metro lines, districts and filters all change with the city.`;
}

/**
 * The distance anchors this city offers. Hidden when there is only one — a select
 * with a single option is noise — but the label and badge still name it.
 */
function renderLandmarks() {
  const sel = $('landmark');
  const marks = catalog.city.landmarks || [];
  sel.textContent = '';
  for (const l of marks) {
    const o = document.createElement('option');
    o.value = l.key;
    o.textContent = l.name;
    sel.appendChild(o);
  }
  $('landmark-field').hidden = marks.length < 2;
  syncLandmark();
}

/** Keep the anchor's name in the badge, the label and the radius select in step. */
function syncLandmark() {
  const mark = currentLandmark();
  $('landmark-badge').hidden = !mark;
  if (!mark) {
    // No anchor for this city: the radius filter has nothing to measure against.
    $('maxFair').value = '';
    $('maxFair').disabled = true;
    $('maxFair-label').textContent = 'Max distance to landmark';
    return;
  }
  $('maxFair').disabled = false;
  $('maxFair-label').textContent = `Max distance to ${mark.name}`;
  $('landmark-badge-text').textContent = `${mark.name} reference`;
  $('landmark-badge').title = `Every listing shows its distance to ${mark.name} (${mark.nameCn})`;
}

/** Whole-line options. Only lines Tujia gives a 全线 filter id for are selectable. */
function renderLines() {
  const sel = $('metroLine');
  sel.textContent = '';
  const any = document.createElement('option');
  any.value = '';
  any.textContent = 'Any line';
  sel.appendChild(any);
  for (const line of catalog.metroLines) {
    if (!line.filterValue) continue;
    const o = document.createElement('option');
    o.value = line.filterValue;
    o.textContent = `${line.label} · ${line.stations.length} stops`;
    sel.appendChild(o);
  }
}

/**
 * A station and a line are both type-5 geo conditions and Tujia honours only one, so
 * the two selects are mutually exclusive. Picking a station wins; picking a line
 * clears the station.
 */
function syncLocationHint() {
  const line = $('metroLine');
  const station = $('metroStation');
  const hint = $('location-hint');

  // The line-distance filter only means anything with a line selected, so it appears
  // and disappears with one rather than sitting there inert.
  const lineActive = !station.value && Boolean(line.value);
  $('lineDistance-field').hidden = !lineActive;
  if (!lineActive) $('maxLineKm').value = '';

  if (station.value) {
    line.disabled = true;
    const name = station.selectedOptions[0]?.textContent || 'a station';
    hint.textContent = `Searching around ${name}. Clear it to filter by a whole line instead.`;
  } else if (line.value) {
    line.disabled = false;
    const label = line.selectedOptions[0]?.textContent || 'this line';
    hint.textContent =
      `Searching along ${label.split(' · ')[0]}. Tujia's own line filter is generous — ` +
      'tighten it below if you want to be genuinely walkable to it.';
  } else {
    line.disabled = false;
    hint.textContent = 'Pick a line for a whole corridor, or a single station to narrow it down.';
  }
}

function renderStations() {
  const sel = $('metroStation');
  const term = $('station-filter').value.trim().toLowerCase();
  const keep = sel.value;

  sel.textContent = '';
  const any = document.createElement('option');
  any.value = '';
  any.textContent = `Anywhere in ${catalog ? catalog.city.name : 'this city'}`;
  sel.appendChild(any);

  for (const line of catalog ? catalog.metroLines : []) {
    const matches = line.stations.filter(
      (s) =>
        !term ||
        s.en.toLowerCase().includes(term) ||
        s.cn.includes(term) ||
        line.en.toLowerCase().includes(term)
    );
    if (!matches.length) continue;

    const group = document.createElement('optgroup');
    group.label = line.en;
    for (const s of matches) {
      const o = document.createElement('option');
      o.value = s.value;
      o.textContent = s.en;
      o.dataset.name = s.cn;
      o.dataset.lng = s.lng;
      o.dataset.lat = s.lat;
      group.appendChild(o);
    }
    sel.appendChild(group);
  }
  if (keep) sel.value = keep;
}

function renderSorts() {
  const sel = $('sort');
  sel.textContent = '';
  for (const s of catalog.sortOptions) {
    const o = document.createElement('option');
    o.value = s.value;
    o.textContent = s.en;
    if (s.value === '1') o.selected = true;
    sel.appendChild(o);
  }
}

function renderAmenities() {
  const host = $('amenity-groups');
  host.textContent = ''; // the vocabulary is per city, so a reload replaces it wholesale
  // Most useful groups first for a foreign visitor.
  const priority = ['Special requirements', 'Facilities', 'Services', 'Neighbourhood'];
  const groups = [...catalog.amenityGroups].sort(
    (a, b) =>
      (priority.indexOf(a.en) + 1 || 99) - (priority.indexOf(b.en) + 1 || 99) ||
      a.en.localeCompare(b.en)
  );

  for (const g of groups) {
    const details = document.createElement('details');
    if (g.en === 'Special requirements') details.open = true;

    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.textContent = g.en;
    const count = document.createElement('span');
    count.className = 'count';
    count.hidden = true;
    summary.append(label, count);
    details.appendChild(summary);

    const items = document.createElement('div');
    items.className = 'items';
    for (const item of g.items) {
      const l = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = item.value;
      cb.dataset.group = g.en;
      cb.addEventListener('change', () => {
        const n = items.querySelectorAll('input:checked').length;
        count.hidden = n === 0;
        count.textContent = String(n);
      });
      const text = document.createElement('span');
      text.textContent = item.en;
      text.title = item.cn;
      l.append(cb, text);
      items.appendChild(l);
    }
    details.appendChild(items);
    host.appendChild(details);
  }
}

/* ── small helpers ────────────────────────────────────────────────── */

function updateNights() {
  const a = new Date($('checkIn').value);
  const b = new Date($('checkOut').value);
  const nights = Math.round((b - a) / 86400000);
  $('nights').textContent =
    Number.isFinite(nights) && nights > 0 ? `${nights} nights` : 'Check-out must be after check-in';
}

function updatePriceHint() {
  const min = Number($('priceMin').value) || 0;
  const max = Number($('priceMax').value) || 0;
  $('price-hint').textContent = `≈ €${Math.round(min * CNY_TO_EUR)}–€${Math.round(max * CNY_TO_EUR)} per night`;
}

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

/**
 * Tujia listing titles are Chinese keyword strings with no English equivalent
 * available from the API, so build a readable headline out of the structured
 * facts instead and keep the original underneath.
 */
function headline(h) {
  const bits = [];
  if (h.room.type) bits.push(h.room.type);
  if (h.room.areaSqm) bits.push(`${h.room.areaSqm} m²`);
  const where = h.location.districtEn || h.location.district;
  return (bits.join(' · ') || 'Stay') + (where ? ` in ${where}` : '');
}

/* ── search ───────────────────────────────────────────────────────── */

async function onSubmit(event) {
  event.preventDefault();

  const stationOpt = $('metroStation').selectedOptions[0];
  const stationId = $('metroStation').value;

  const body = {
    cityId: $('city').value || catalog?.city.id,
    checkIn: $('checkIn').value,
    checkOut: $('checkOut').value,
    guestCount: Number($('guestCount').value),
    priceMin: Number($('priceMin').value) || 0,
    priceMax: Number($('priceMax').value) || 300,
    sort: $('sort').value,
    amenities: [...document.querySelectorAll('#amenity-groups input:checked')].map((c) => c.value),
  };

  if (stationId) {
    body.metroStationId = stationId;
    body.metroStationName = stationOpt.dataset.name;
    body.metroLng = Number(stationOpt.dataset.lng);
    body.metroLat = Number(stationOpt.dataset.lat);
  } else if ($('metroLine').value) {
    body.metroLineId = $('metroLine').value;
    if ($('maxLineKm').value) body.maxDistanceToMetroLineKm = Number($('maxLineKm').value);
  }
  const mark = currentLandmark();
  if (mark) body.landmarkKey = mark.key;
  if ($('maxFair').value) body.maxDistanceToLandmarkKm = Number($('maxFair').value);

  paging = { body, nextPageIndex: null, seen: new Set(), loading: false };

  setLoading(true);
  try {
    const data = await postSearch(body);
    render(data);
  } catch (err) {
    showStatus('Search failed', err.message, true);
    $('grid').textContent = '';
    $('summary').hidden = true;
    removeLoadMore();
  } finally {
    setLoading(false);
  }
}

async function postSearch(body) {
  const res = await fetch('/api/v1/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.hint || data.message || `HTTP ${res.status}`);
  return data;
}

/** Fetch the next page and append, rather than replacing what is on screen. */
async function loadMore() {
  if (paging.loading || paging.nextPageIndex === null || !paging.body) return;
  paging.loading = true;

  const btn = $('load-more');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Loading…';

  try {
    const data = await postSearch({ ...paging.body, pageIndex: paging.nextPageIndex });
    appendResults(data);
  } catch (err) {
    btn.textContent = 'Retry';
    btn.disabled = false;
    $('load-more-note').textContent = err.message;
    return;
  } finally {
    paging.loading = false;
  }
  if ($('load-more')) {
    $('load-more').disabled = false;
    $('load-more').textContent = label;
  }
}

function setLoading(on) {
  $('search-btn').disabled = on;
  $('search-btn').textContent = on ? 'Searching…' : 'Search';
  if (on) {
    $('status').hidden = true;
    $('summary').hidden = true;
    removeLoadMore();
    $('grid').innerHTML = Array.from({ length: 6 })
      .map(
        () => `<article class="card skeleton">
            <div class="sk sk-media"></div>
            <div class="card-body">
              <div class="sk sk-line"></div>
              <div class="sk sk-line short"></div>
              <div class="sk sk-line"></div>
            </div>
          </article>`
      )
      .join('');
  }
}

function showStatus(title, text, isError) {
  const s = $('status');
  s.hidden = false;
  s.className = 'status' + (isError ? ' error' : '');
  s.innerHTML = `<div class="status-inner"><h2>${esc(title)}</h2><p>${esc(text)}</p></div>`;
}

/* ── render ───────────────────────────────────────────────────────── */

function render(data) {
  const grid = $('grid');
  grid.textContent = '';
  removeLoadMore();
  paging.seen = new Set();
  paging.nextPageIndex = data.nextPageIndex ?? null;

  const sum = $('summary');
  sum.hidden = false;
  const parts = [`<strong>${data.total}</strong> shown`];
  if (data.city) parts.push(esc(data.city.name));
  if (data.totalAvailable != null) parts.push(`${data.totalAvailable} match your filters`);
  if (data.bookableCount != null) parts.push(`${data.bookableCount} bookable for these dates`);
  // Both radius filters are applied locally, so say how much had to be searched to
  // fill the page — and name the filter that actually caused it, not just the landmark.
  if (data.scanned != null) {
    const why = [];
    if (paging.body?.maxDistanceToMetroLineKm) why.push('distance to the line');
    if (paging.body?.maxDistanceToLandmarkKm) why.push(`distance to ${data.landmark?.name || 'the landmark'}`);
    parts.push(esc(`searched ${data.scanned} for ${why.join(' and ') || 'your distance limits'}`));
  }
  if (data.cached) parts.push('cached');
  // Tujia masks prices for logged-out sessions. Say so once, at the top, rather than
  // leaving every card's range unexplained.
  if (data.results.some((h) => h.price.masked)) {
    parts.push('<span class="warn">prices approximate — session not logged in</span>');
  }
  sum.innerHTML = parts.join(' <span class="sep">·</span> ');

  if (!data.results.length) {
    // Whichever local radius is active is the one to name in the empty state; saying
    // "not within N km of the landmark" when the line filter emptied the page is just
    // misleading.
    const lineKm = paging.body?.maxDistanceToMetroLineKm;
    const landmarkKm = paging.body?.maxDistanceToLandmarkKm;
    const limit = lineKm
      ? `${lineKm} km of the line`
      : `${landmarkKm} km of ${data.landmark?.name || 'the landmark'}`;

    if (data.scanned != null && data.hasMore) {
      // The scan budget ran out in a sparse stretch — there is more to look through.
      showStatus(
        'Nothing in this batch',
        `Searched ${data.scanned} listings without a match within ${limit}. ` +
          'Keep looking, or widen the radius.',
        false
      );
      syncLoadMore(data);
      return;
    }
    if (data.scanned != null && landmarkKm && !lineKm && !$('metroStation').value && allStations.length) {
      // Distance to the anchor is filtered locally over popularity-ranked results, so a
      // tight radius rarely lands. Anchoring the search on a nearby station works better.
      const name = data.landmark?.name || 'the landmark';
      showStatus(
        `No stays that close to ${name}`,
        `Searched ${data.scanned} listings and none were within ${landmarkKm} km. ` +
          'Anchoring on a nearby station works better — try one of these.',
        false
      );
      offerLandmarkStations();
    } else {
      showStatus(
        'No stays found',
        data.scanned != null
          ? `Searched ${data.scanned} listings but none were within your distance limit. Try a wider radius.`
          : 'Try widening the price range, or removing a filter.',
        false
      );
    }
    return;
  }
  $('status').hidden = true;

  for (const h of data.results) {
    paging.seen.add(h.id);
    grid.appendChild(card(h));
  }
  syncLoadMore(data);
}

/** Append a further page, skipping anything already on screen. */
function appendResults(data) {
  const grid = $('grid');
  paging.nextPageIndex = data.nextPageIndex ?? null;

  let added = 0;
  for (const h of data.results) {
    if (paging.seen.has(h.id)) continue; // Tujia can repeat a listing as its ranking drifts
    paging.seen.add(h.id);
    grid.appendChild(card(h));
    added++;
  }

  const sum = $('summary').querySelector('strong');
  if (sum) sum.textContent = String(paging.seen.size);

  syncLoadMore(data, added);
}

function removeLoadMore() {
  $('load-more-wrap')?.remove();
}

/** Create, update, or retire the Load-more control based on the latest response. */
function syncLoadMore(data, added) {
  removeLoadMore();
  if (!data.hasMore || paging.nextPageIndex === null) {
    if (paging.seen.size) {
      // Only claim completeness once upstream is genuinely exhausted.
      const done = document.createElement('p');
      done.id = 'load-more-wrap';
      done.className = 'load-more-done';
      done.textContent = `That's all ${paging.seen.size} listings we could load.`;
      $('results-end').appendChild(done);
    }
    return;
  }

  const wrap = document.createElement('div');
  wrap.id = 'load-more-wrap';
  wrap.className = 'load-more-wrap';

  const btn = document.createElement('button');
  btn.id = 'load-more';
  btn.type = 'button';
  btn.className = 'load-more';
  btn.textContent = 'Load more';
  btn.addEventListener('click', loadMore);

  const note = document.createElement('p');
  note.id = 'load-more-note';
  note.className = 'load-more-note';
  if (added === 0) {
    // Every listing on that page was a duplicate — say so instead of looking broken.
    note.textContent = 'That page repeated listings already shown. Try again for more.';
  } else if (data.totalAvailable != null) {
    note.textContent = `${paging.seen.size} of ${data.totalAvailable} loaded`;
  }

  wrap.append(btn, note);
  $('results-end').appendChild(wrap);
}

/**
 * Offer one-click shortcuts to the metro stations closest to the active anchor,
 * ranked using the coordinates the catalog ships for both.
 */
function offerLandmarkStations() {
  const mark = currentLandmark();
  if (!mark || !allStations.length) return;

  // Interchange stations appear once per line with different filter ids; keep the nearest.
  const byName = new Map();
  for (const s of allStations.map((s) => ({ ...s, d: kmBetween(s, mark) }))) {
    const prev = byName.get(s.en);
    if (!prev || s.d < prev.d) byName.set(s.en, s);
  }
  const nearest = [...byName.values()].sort((a, b) => a.d - b.d).slice(0, 5);

  const box = document.createElement('div');
  box.className = 'suggest';
  box.innerHTML = `<span>Stations near ${esc(mark.name)}:</span>`;
  for (const s of nearest) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip suggest-chip';
    btn.textContent = `${s.en} · ${s.d.toFixed(1)} km`;
    btn.addEventListener('click', () => {
      $('station-filter').value = '';
      renderStations();
      $('metroStation').value = s.value;
      $('metroLine').value = '';
      $('maxFair').value = '';
      syncLocationHint();
      $('search-form').requestSubmit();
    });
    box.appendChild(btn);
  }
  $('status').querySelector('.status-inner').appendChild(box);
}

/** Straight-line km between two lng/lat points, matching the server's haversine. */
function kmBetween(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Link to our translated detail page, carrying the stay so prices stay consistent. */
function detailHref(h) {
  const q = new URLSearchParams({ id: h.id });
  if (paging.body?.checkIn) q.set('checkIn', paging.body.checkIn);
  if (paging.body?.checkOut) q.set('checkOut', paging.body.checkOut);
  if (paging.body?.guestCount) q.set('guests', String(paging.body.guestCount));
  // The detail endpoint resolves the city from the payload, but the anchor is the
  // user's choice — carry it so the page measures the same distance the card did.
  if (paging.body?.cityId) q.set('city', paging.body.cityId);
  if (paging.body?.landmarkKey) q.set('landmark', paging.body.landmarkKey);
  return `/listing.html?${q}`;
}

/**
 * The price corner of a card.
 *
 * On an anonymous Tujia session the figure comes back masked ("1??"), not withheld —
 * each ? is one hidden digit, so the server turns it into a real range. Show that
 * range rather than a fake precise number or a bare dash, and say why it is a range.
 */
function priceBlock(p) {
  if (p.masked && p.fromEUR != null) {
    return `<div>
        <span class="eur">€${p.fromEUR}–€${p.toEUR}</span>
        <span class="unit">/night</span>
      </div>
      <span class="cny masked" title="Tujia only reveals exact prices to logged-in users. The range is what its masked figure (¥${p.fromCNY}??) pins down.">¥${p.fromCNY}–${p.toCNY} · approx</span>`;
  }
  if (p.perNightEUR == null) {
    return `<div><span class="eur">—</span></div><span class="cny masked">price unavailable</span>`;
  }
  return `<div>
      ${p.originalEUR ? `<span class="eur was">€${p.originalEUR}</span>` : ''}
      <span class="eur">€${p.perNightEUR}</span>
      <span class="unit">/night</span>
    </div>
    <span class="cny">¥${p.perNightCNY} CNY</span>`;
}

function card(h) {
  const el = document.createElement('article');
  el.className = 'card';

  const img = h.images[0] || '';
  const landmarkKm = h.location.distanceToLandmarkKm;
  const anchor = h.location.distanceToSearchAnchorM;

  const facts = [];
  if (h.room.maxGuests) facts.push(`<span class="fact">${h.room.maxGuests} guests</span>`);
  if (h.room.bedrooms) facts.push(`<span class="fact">${h.room.bedrooms} bed${h.room.bedrooms > 1 ? 's' : ''}room</span>`);
  if (landmarkKm != null && h.location.landmark) {
    facts.push(`<span class="fact fair">${landmarkKm} km to ${esc(h.location.landmark)}</span>`);
  }
  // Distance to the anchor station is only meaningful when the search had one.
  if (anchor != null && h.location.searchAnchor) {
    facts.push(
      `<span class="fact">${(anchor / 1000).toFixed(1)} km to ${esc(h.location.searchAnchor)}</span>`
    );
  }

  // Nearest metro, computed for every listing from its own coordinates.
  //
  // When a whole-line filter is active we lead with the nearest station *on that line*.
  // The globally nearest station is frequently on a different line (Line 11 is a loop
  // that interchanges with nearly everything), which reads as a broken filter even
  // though it is accurate. Show the corridor the user asked for first, and the truly
  // nearest station underneath when it differs.
  const m = h.location.nearestMetro;
  const onLine = h.location.nearestOnLine;
  const fmt = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

  let metroRow = '';
  if (onLine) {
    metroRow = `<div class="metro">
        <span class="metro-lines"><span class="line">${esc(onLine.line)}</span></span>
        <span class="metro-name">${esc(onLine.station)}</span>
        <span class="metro-dist">${fmt(onLine.distanceKm)} · ${onLine.walkMinutes} min walk</span>
      </div>`;
    if (m && m.station !== onLine.station) {
      metroRow += `<p class="metro-alt">Closest overall: ${esc(m.station)} (${esc(m.lines.join(', '))}) · ${fmt(m.distanceKm)}</p>`;
    }
  } else if (m) {
    metroRow = `<div class="metro">
        <span class="metro-lines">${m.lines.map((l) => `<span class="line">${esc(l)}</span>`).join('')}</span>
        <span class="metro-name">${esc(m.station)}</span>
        <span class="metro-dist">${fmt(m.distanceKm)} · ${m.walkMinutes} min walk</span>
      </div>`;
  }

  const shown = h.amenities.slice(0, 5);
  const extra = h.amenities.length - shown.length;
  const chips = [
    ...shown.map((a) => `<span class="chip">${esc(a)}</span>`),
    ...(extra > 0 ? [`<span class="chip more">+${extra}</span>`] : []),
    ...h.promotions.slice(0, 1).map((p) => `<span class="chip promo">${esc(p)}</span>`),
  ].join('');

  el.innerHTML = `
    <div class="card-media">
      ${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
      ${h.imageCount > 1 ? `<span class="shots">${h.imageCount} photos</span>` : ''}
      ${h.available ? '' : '<div class="unavailable">Not available</div>'}
    </div>
    <div class="card-body">
      <div class="card-head">
        <div>
          <h3 class="card-title">${esc(headline(h))}</h3>
          <p class="card-orig" lang="zh-CN" title="${esc(h.nameOriginal)}">${esc(h.nameOriginal)}</p>
        </div>
        ${
          h.rating
            ? `<div class="rating">
                 <span class="score">${h.rating}</span>
                 <span class="count">${h.reviewCount} review${h.reviewCount === 1 ? '' : 's'}</span>
               </div>`
            : ''
        }
      </div>
      <div class="facts">${facts.join('')}</div>
      ${metroRow}
      ${h.reviewHighlight ? `<p class="quote">${esc(h.reviewHighlight)}</p>` : ''}
      <div class="chips">${chips}</div>
      <div class="card-foot">
        <div class="price">${priceBlock(h.price)}</div>
        <a class="book" href="${esc(detailHref(h))}" target="_blank" rel="noopener">Details ↗</a>
      </div>
    </div>`;
  return el;
}

boot();
