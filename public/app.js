'use strict';

const $ = (id) => document.getElementById(id);
const CNY_TO_EUR = 0.13; // mirrors CONFIG.CNY_TO_EUR

let catalog = null;
let allStations = []; // flattened, for the nearest-station suggestions
/** Datalist label ("Gaozeng · Line 3") → station. The label is what the input holds. */
let stationByLabel = new Map();

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
  populateBedrooms();
  setDefaultDates();
  updatePriceHint();

  $('checkIn').addEventListener('change', onCheckInChange);
  $('checkOut').addEventListener('change', onCheckOutChange);
  $('stay-length').addEventListener('change', onStayLengthChange);
  $('priceMin').addEventListener('input', updatePriceHint);
  $('priceMax').addEventListener('input', updatePriceHint);
  $('station').addEventListener('input', () => {
    $('station').setCustomValidity('');
    if (selectedStation()) $('metroLine').value = ''; // station is the narrower ask
    syncLocationHint();
  });
  $('metroLine').addEventListener('change', () => {
    if ($('metroLine').value) $('station').value = '';
    syncLocationHint();
  });
  $('amenity-filter').addEventListener('input', filterAmenities);
  $('clear-btn').addEventListener('click', clearFilters);
  $('filters-toggle').addEventListener('click', () => setFiltersOpen($('filters').hidden));
  $('bestLocation').addEventListener('change', onBestLocationChange);
  $('search-form').addEventListener('submit', onSubmit);
  // Any edit can change how many filters are active, so recount on all of them.
  $('search-form').addEventListener('input', syncClearButton);
  $('search-form').addEventListener('change', syncClearButton);
  $('landmark').addEventListener('change', syncLandmark);
  // Sort lives above the results, so changing it re-runs the search that is showing
  // rather than waiting for a Search press the user would not think to make.
  $('sort').addEventListener('change', () => {
    if (paging.body) $('search-form').requestSubmit();
  });
  $('panel-summary').addEventListener('click', () => setPanelCollapsed(false));
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
  renderBestLocation();
  syncLocationHint();
  syncClearButton();

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

/* Dates are handled as YYYY-MM-DD strings in the visitor's own calendar. Arithmetic
   goes through a local-midnight Date, never `new Date('YYYY-MM-DD')`, which is UTC
   and lands on the previous day west of Greenwich. */
const isoDay = (d) => d.toLocaleDateString('sv'); // sv-SE formats as YYYY-MM-DD
const localDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (iso, n) => {
  const d = localDate(iso);
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
const nightsBetween = (a, b) => Math.round((localDate(b) - localDate(a)) / 86400000);

/** The ticked stay-length preset in nights, or null for "Custom" (exact dates). */
const stayPreset = () => Number(document.querySelector('input[name="stay"]:checked')?.value) || null;

/** Default stay: today → today + the preset (1 week), in the visitor's own calendar day. */
function setDefaultDates() {
  $('checkIn').value = isoDay(new Date());
  applyStayLength();
}

/** With a preset ticked, check-out follows check-in, so moving the arrival keeps the length. */
function applyStayLength() {
  const n = stayPreset();
  if (n && $('checkIn').value) $('checkOut').value = addDays($('checkIn').value, n);
  syncDateLimits();
  updateNights();
}

/** Nothing before today, and check-out at least a night after check-in. */
function syncDateLimits() {
  const today = isoDay(new Date());
  $('checkIn').min = today;
  $('checkOut').min = addDays($('checkIn').value || today, 1);
}

function onCheckInChange() {
  if (stayPreset()) return applyStayLength();
  // Exact dates: keep check-out, unless the new arrival has overtaken it.
  if ($('checkIn').value && $('checkOut').value <= $('checkIn').value) {
    $('checkOut').value = addDays($('checkIn').value, 1);
  }
  syncDateLimits();
  updateNights();
}

/** A hand-picked check-out is exact dates, unless it happens to match a preset. */
function onCheckOutChange() {
  const n = nightsBetween($('checkIn').value, $('checkOut').value);
  const match = document.querySelector(`input[name="stay"][value="${n}"]`);
  (match || document.querySelector('input[name="stay"][value=""]')).checked = true;
  updateNights();
}

function onStayLengthChange() {
  if (stayPreset()) return applyStayLength();
  // "Custom": open the check-out picker, which is the date they now want to set.
  try { $('checkOut').showPicker(); } catch { $('checkOut').focus(); }
}

function populateBedrooms() {
  const sel = $('bedrooms');
  for (let n = 0; n <= 5; n++) {
    const o = document.createElement('option');
    o.value = String(n);
    o.textContent = n === 0 ? 'Any' : n === 1 ? '1 bedroom' : `${n} bedrooms`;
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
    syncBestLocation();
    return;
  }
  $('maxFair').disabled = false;
  $('maxFair-label').textContent = `Max distance to ${mark.name}`;
  $('landmark-badge-text').textContent = `${mark.name} reference`;
  $('landmark-badge').title = `Every listing shows its distance to ${mark.name} (${mark.nameCn})`;
  syncBestLocation();
}

/** A line counts as serving a landmark if one of its stops is a walk away from it. */
const ADVICE_MAX_KM = 2;
/** Option value for "a location was set in Filters that this menu does not list". */
const CUSTOM_LOCATION = 'custom';

/**
 * "Best location": for each of the city's landmarks, the metro lines that stop near
 * it, closest stop first. Staying anywhere along one means a direct ride there.
 * Straight-line distance over the catalog's own coordinates, the same bd09 points
 * the cards measure with, so the advice and the cards agree.
 */
function renderBestLocation() {
  const sel = $('bestLocation');
  sel.textContent = '';
  const add = (parent, value, text, disabled = false) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    o.disabled = disabled;
    parent.appendChild(o);
    return o;
  };
  add(sel, '', `Anywhere in ${catalog.city.name}`);

  for (const mark of catalog.city.landmarks || []) {
    // Branches repeat a line name; keep the segment whose stop is closest.
    const byLine = new Map();
    for (const line of catalog.metroLines) {
      if (!line.filterValue) continue; // the option filters the whole line
      for (const s of line.stations) {
        const d = kmBetween(s, mark);
        const prev = byLine.get(line.en);
        if (!prev || d < prev.d) byLine.set(line.en, { line, station: s, d });
      }
    }
    const near = [...byLine.values()]
      .filter((x) => x.d <= ADVICE_MAX_KM)
      .sort((a, b) => a.d - b.d)
      .slice(0, 4);

    const group = document.createElement('optgroup');
    group.label = `Near ${mark.name}`;
    if (!near.length) {
      // Saying so beats recommending a line whose nearest stop is a taxi ride away.
      add(group, '', `No metro stop within ${ADVICE_MAX_KM} km`, true);
    }
    for (const { line, station, d } of near) {
      const walk = Math.max(1, Math.ceil((d / 4.5) * 60)); // utils/geo.ts walkMinutes(), 4.5 km/h
      const o = add(group, `${mark.key}|${line.filterValue}`,
        `${line.en} · ${station.en.replace(/ Station$/, '')}, ${walk} min walk`);
      o.title = `Stay anywhere along ${line.label}: its ${station.en} stop is ${d.toFixed(1)} km from ${mark.name}`;
    }
    sel.appendChild(group);
  }
  add(sel, CUSTOM_LOCATION, 'Custom, set in Filters').hidden = true;
  sel.disabled = !catalog.metroLines.length;
  syncBestLocation();
}

/** True while the location filters are exactly a Best location suggestion. */
const pickedBestLocation = () => !['', CUSTOM_LOCATION].includes($('bestLocation').value);

/** Pick a suggestion: measure from its landmark, filter to its line, keep it walkable. */
function onBestLocationChange() {
  const v = $('bestLocation').value;
  if (v === CUSTOM_LOCATION) return setFiltersOpen(true);
  $('station').value = '';
  $('metroLine').value = '';
  $('maxLineKm').value = '';
  if (v) {
    const [key, line] = v.split('|');
    $('landmark').value = key;
    syncLandmark();
    $('metroLine').value = line;
  }
  syncLocationHint();
  // Tujia's own "near the line" reaches 4 km out (53 minutes on foot), which is no
  // advice at all, so a suggestion always comes with a walkable radius.
  if (v) $('maxLineKm').value = '1.5';
  syncClearButton();
}

/**
 * Reflect the location filters back into the menu, whichever control set them: the
 * matching suggestion, "Anywhere", or "Custom" for a station or line it does not list.
 */
function syncBestLocation() {
  const sel = $('bestLocation');
  if (!sel.options.length) return; // not rendered yet
  const line = $('metroLine').value;
  const match = line && [...sel.options].find((o) => o.value === `${$('landmark').value}|${line}`);
  const custom = sel.querySelector(`option[value="${CUSTOM_LOCATION}"]`);
  const isCustom = !match && Boolean(line || $('station').value.trim());
  custom.hidden = !isCustom;
  sel.value = match ? match.value : isCustom ? CUSTOM_LOCATION : '';
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
 * the two are mutually exclusive. Picking a station wins; picking a line clears the
 * station.
 */
function syncLocationHint() {
  const line = $('metroLine');
  const station = selectedStation();
  const hint = $('location-hint');

  // The line-distance filter only means anything with a line selected, so it appears
  // and disappears with one rather than sitting there inert.
  syncBestLocation();
  const lineActive = !station && Boolean(line.value);
  $('lineDistance-field').hidden = !lineActive;
  if (!lineActive) $('maxLineKm').value = '';

  if (station) {
    line.disabled = true;
    hint.textContent = `Searching around ${station.en}. Clear the station to filter by a whole line instead.`;
  } else if (line.value) {
    line.disabled = false;
    const label = line.selectedOptions[0]?.textContent || 'this line';
    hint.textContent =
      `Searching along ${label.split(' · ')[0]}. Tujia's own line filter is generous — ` +
      'tighten it above if you want to be genuinely walkable to it.';
  } else {
    line.disabled = false;
    hint.textContent = allStations.length
      ? `No metro filter: anywhere in ${catalog?.city.name || 'the city'}.`
      : `${catalog?.city.name || 'This city'} has no metro in the catalog.`;
  }
}

/**
 * One searchable field instead of a filter box over a 400-option select. The datalist
 * label carries the line, because interchanges and branches repeat a name with a
 * different filter id per line.
 */
function renderStations() {
  const list = $('station-list');
  list.textContent = '';
  stationByLabel = new Map();
  for (const line of catalog ? catalog.metroLines : []) {
    for (const s of line.stations) {
      if (!s.value) continue; // an extraStations entry: no Tujia id to search it by
      const label = `${s.en} · ${line.en}`;
      if (stationByLabel.has(label)) continue; // a branch segment repeating its trunk
      stationByLabel.set(label, s);
      const o = document.createElement('option');
      o.value = label;
      o.label = s.cn; // shown beside the name, and matched when typing Chinese
      list.appendChild(o);
    }
  }
  // A station from the previous city means nothing here.
  if ($('station').value && !selectedStation()) $('station').value = '';
  $('station').disabled = stationByLabel.size === 0;
  $('station').placeholder = stationByLabel.size ? 'Type a station name' : 'No metro in this city';
}

/** The station the input names, or null. A bare name (English or Chinese) works too. */
function selectedStation() {
  const text = $('station').value.trim();
  if (!text) return null;
  const exact = stationByLabel.get(text);
  if (exact) return exact;
  // Catalog names carry a "Station" suffix nobody types, so compare without it.
  const bare = (s) => s.toLowerCase().replace(/\s+station$/, '').trim();
  const want = bare(text);
  const all = [...stationByLabel.values()];
  const hit = all.find((s) => bare(s.en) === want || s.cn === text || s.cn === `${text}站`);
  if (hit) return hit; // same name on several lines: any of them anchors the same spot
  // Otherwise a prefix, but only when it names exactly one place.
  const names = new Set(all.filter((s) => bare(s.en).startsWith(want)).map((s) => s.en));
  return names.size === 1 ? all.find((s) => names.has(s.en)) : null;
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

/**
 * Ticked on first load. Accepting foreign guests is a licence many Chinese hosts lack
 * (they must register guests' passports), so for this site's visitors an untick is
 * the exception — and every city ships the filter under the same id.
 */
const DEFAULT_AMENITIES = new Set(['237']);

function renderAmenities() {
  const host = $('amenity-groups');
  // Filter ids are globally unique, so a city switch keeps whatever is ticked and
  // exists in the new city too. First load starts from the defaults.
  const ticked = host.childElementCount
    ? new Set([...host.querySelectorAll('input:checked')].map((c) => c.value))
    : DEFAULT_AMENITIES;
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
      cb.checked = ticked.has(item.value);
      cb.dataset.group = g.en;
      cb.addEventListener('change', () => syncGroupCount(details));
      const text = document.createElement('span');
      text.textContent = item.en;
      text.title = item.cn;
      l.dataset.search = `${item.en} ${item.cn}`.toLowerCase();
      l.append(cb, text);
      items.appendChild(l);
    }
    details.appendChild(items);
    host.appendChild(details);
    syncGroupCount(details);
  }
  $('amenity-filter').value = '';
  $('amenity-empty').hidden = true;
}

/** The badge on a group's summary, so a ticked filter shows even with the group shut. */
function syncGroupCount(details) {
  const n = details.querySelectorAll('input:checked').length;
  const count = details.querySelector('.count');
  count.hidden = n === 0;
  count.textContent = String(n);
}

/**
 * Narrow ~95 filters across a dozen folded groups to the ones whose English or
 * Chinese name matches, opening the groups that still hold a match. Clearing the box
 * puts the groups back as the user left them.
 */
function filterAmenities() {
  const term = $('amenity-filter').value.trim().toLowerCase();
  let any = false;
  for (const details of $('amenity-groups').querySelectorAll('details')) {
    if (!term) {
      if (details.dataset.wasOpen != null) details.open = details.dataset.wasOpen === '1';
      delete details.dataset.wasOpen;
      details.hidden = false;
      details.querySelectorAll('label').forEach((l) => (l.hidden = false));
      continue;
    }
    if (details.dataset.wasOpen == null) details.dataset.wasOpen = details.open ? '1' : '0';
    let hits = 0;
    for (const l of details.querySelectorAll('label')) {
      l.hidden = !l.dataset.search.includes(term);
      if (!l.hidden) hits++;
    }
    details.hidden = hits === 0;
    details.open = hits > 0;
    any ||= hits > 0;
  }
  $('amenity-empty').hidden = !term || any;
}

/**
 * Every departure from the defaults that lives behind the Filters button. Price and
 * bedrooms sit in the main row, always in view, so like the dates they are not counted.
 */
function activeFilterCount() {
  // A default filter counts only once unticked: that is the change Clear would undo.
  let n = 0;
  for (const cb of document.querySelectorAll('#amenity-groups input')) {
    if (cb.checked !== DEFAULT_AMENITIES.has(cb.value)) n++;
  }
  // A suggestion picked from Best location is a main-row choice, in view like price.
  if (!pickedBestLocation()) {
    if ($('station').value.trim() || $('metroLine').value) n++;
    if ($('maxLineKm').value) n++;
  }
  if ($('maxFair').value) n++;
  return n;
}

/** Keep Clear, the count on the Filters button and the summary sentence in step. */
function syncClearButton() {
  const n = activeFilterCount();
  $('clear-btn').hidden = n === 0;
  $('filters-count').hidden = n === 0;
  $('filters-count').textContent = String(n);
  $('filters-toggle').setAttribute('aria-label', n ? `Filters, ${n} changed` : 'Filters');
  $('active-summary').textContent = describeActiveFilters();
}

/**
 * What is applied, in words, so the folded panel never has to be opened just to
 * check. Defaults count too: "Accepts foreign guests" is a filter the visitor should
 * know is on.
 */
function describeActiveFilters() {
  const bits = [];
  const station = selectedStation();
  const line = $('metroLine').value && $('metroLine').selectedOptions[0]?.textContent.split(' · ')[0];
  if (station) bits.push(`near ${station.en.replace(/ Station$/, '')}`);
  else if (line) bits.push($('maxLineKm').value ? `within ${$('maxLineKm').value} km of ${line}` : `along ${line}`);
  const mark = currentLandmark();
  if ($('maxFair').value && mark) bits.push(`within ${$('maxFair').value} km of ${mark.name}`);
  for (const cb of document.querySelectorAll('#amenity-groups input:checked')) {
    bits.push(cb.nextElementSibling.textContent);
  }
  if (!bits.length) return 'No filters: anywhere in the city.';
  const shown = bits.slice(0, 4);
  const more = bits.length - shown.length;
  const text = shown.join(' · ') + (more ? ` · +${more} more` : '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The refinements panel folds inline under the trip row; no modal. */
function setFiltersOpen(open) {
  $('filters').hidden = !open;
  $('filters-toggle').setAttribute('aria-expanded', String(open));
}

/**
 * Back to the defaults for what is behind Filters. The main row (the trip, price,
 * bedrooms, a Best location pick) stays as the visitor set it, since it is all in view.
 */
function clearFilters() {
  if (!pickedBestLocation()) {
    $('station').value = '';
    $('metroLine').value = '';
    $('maxLineKm').value = '';
  }
  $('maxFair').value = '';
  $('amenity-filter').value = '';
  for (const cb of document.querySelectorAll('#amenity-groups input')) cb.checked = DEFAULT_AMENITIES.has(cb.value);
  $('amenity-groups').querySelectorAll('details').forEach(syncGroupCount);
  filterAmenities();
  syncLocationHint();
  syncClearButton();
}

/**
 * Phone only (the CSS ignores the class above 900px): fold the form to a one-line
 * summary so a finished search lands on its results, not on the form that made it.
 */
function setPanelCollapsed(collapsed) {
  $('panel').classList.toggle('collapsed', collapsed);
  $('panel-summary').setAttribute('aria-expanded', String(!collapsed));
  if (collapsed) {
    const fmt = (v) => localDate(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const n = activeFilterCount();
    $('panel-summary-text').textContent = [
      catalog?.city.name,
      `${fmt($('checkIn').value)} – ${fmt($('checkOut').value)}`,
      $('guestCount').selectedOptions[0]?.textContent,
      n ? `${n} filter${n === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(' · ');
  }
}

/* ── small helpers ────────────────────────────────────────────────── */

function updateNights() {
  $('checkIn').setCustomValidity('');
  $('checkOut').setCustomValidity('');
  const a = $('checkIn').value, b = $('checkOut').value;
  const nights = a && b ? nightsBetween(a, b) : NaN;
  if (!(nights > 0)) {
    $('nights').textContent = 'Check-out must be after check-in';
    return;
  }
  const fmt = (iso) =>
    localDate(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  $('nights').textContent = `${nights} night${nights === 1 ? '' : 's'} · ${fmt(a)} → ${fmt(b)}`;
}

/**
 * The price is entered in yuan, because that is what Tujia filters on, and converted
 * live at the same fixed rate the cards use, so the two always agree.
 */
function updatePriceHint() {
  const min = Number($('priceMin').value) || 0;
  const max = Number($('priceMax').value) || 0;
  const eur = (cny) => `€${Math.round(cny * CNY_TO_EUR)}`;
  const inverted = max > 0 && min > max;
  $('priceMax').setCustomValidity(inverted ? 'Max must be at least the min.' : '');
  $('price-hint').textContent = inverted
    ? 'Max must be at least the min.'
    : `≈ ${eur(min)} – ${eur(max)} a night`;
  $('price-hint').classList.toggle('error', inverted);
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

  // Catch the typos the form would otherwise send upstream and get nothing back for.
  // A tab left open overnight still holds yesterday's "today", hence the re-check.
  if ($('checkIn').value < isoDay(new Date())) {
    $('checkIn').setCustomValidity('Check-in can’t be in the past.');
    $('checkIn').reportValidity();
    return;
  }
  if ($('checkOut').value <= $('checkIn').value) {
    $('checkOut').setCustomValidity('Check-out must be after check-in.');
    $('checkOut').reportValidity();
    return;
  }
  const station = selectedStation();
  if ($('station').value.trim() && !station) {
    setFiltersOpen(true); // a folded field cannot show its own error
    $('station').setCustomValidity('Pick a station from the list, or clear the field.');
    $('station').reportValidity();
    return;
  }

  const body = {
    cityId: $('city').value || catalog?.city.id,
    checkIn: $('checkIn').value,
    checkOut: $('checkOut').value,
    guestCount: Number($('guestCount').value),
    bedrooms: Number($('bedrooms').value) || undefined,
    priceMin: Number($('priceMin').value) || 0,
    priceMax: Number($('priceMax').value) || 300,
    sort: $('sort').value,
    amenities: [...document.querySelectorAll('#amenity-groups input:checked')].map((c) => c.value),
  };

  if (station) {
    body.metroStationId = station.value;
    body.metroStationName = station.cn;
    body.metroLng = Number(station.lng);
    body.metroLat = Number(station.lat);
  } else if ($('metroLine').value) {
    body.metroLineId = $('metroLine').value;
    if ($('maxLineKm').value) body.maxDistanceToMetroLineKm = Number($('maxLineKm').value);
  }
  const mark = currentLandmark();
  if (mark) body.landmarkKey = mark.key;
  if ($('maxFair').value) body.maxDistanceToLandmarkKm = Number($('maxFair').value);

  paging = { body, nextPageIndex: null, seen: new Set(), loading: false };

  // The results are what they came for now. Folding a tall filters panel would leave
  // the page scrolled past the top of the results, so bring the search back to the top.
  const filtersWereOpen = !$('filters').hidden;
  setFiltersOpen(false);
  if (matchMedia('(max-width: 900px)').matches) {
    setPanelCollapsed(true);
    $('panel').scrollIntoView({ block: 'start' });
  } else if (filtersWereOpen) {
    $('panel').scrollIntoView({ block: 'start' });
  }
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
    if (data.scanned != null && landmarkKm && !lineKm && !paging.body?.metroStationId && allStations.length) {
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

let scrollObserver = null;

function removeLoadMore() {
  scrollObserver?.disconnect();
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

  // Infinite scroll: fetch when the control nears the viewport. The button stays as the
  // fallback, and a page that added nothing does not auto-fire again, or an all-duplicate
  // page would loop forever.
  if (added !== 0 && 'IntersectionObserver' in window) {
    scrollObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        scrollObserver.disconnect();
        loadMore();
      },
      { rootMargin: '600px 0px' }
    );
    scrollObserver.observe(wrap);
  }
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
  // Only searchable stops: each chip runs a station search.
  for (const s of allStations.filter((s) => s.value).map((s) => ({ ...s, d: kmBetween(s, mark) }))) {
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
      $('station').value = `${s.en} · ${s.line}`;
      $('metroLine').value = '';
      $('maxFair').value = '';
      syncLocationHint();
      syncClearButton();
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
