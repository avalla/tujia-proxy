'use strict';

const params = new URLSearchParams(location.search);
const ID = params.get('id');
const CHECK_IN = params.get('checkIn') || '';
const CHECK_OUT = params.get('checkOut') || '';
const GUESTS = params.get('guests') || '';
// Carried over from the search that linked here, so the distance shown below is
// measured from the same anchor the result card used.
const CITY = params.get('city') || '';
const LANDMARK = params.get('landmark') || '';

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

const km = (v) => (v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1)} km`);

function fail(title, msg) {
  document.getElementById('detail').innerHTML =
    `<div class="status error"><div class="status-inner">
       <h2>${esc(title)}</h2><p>${esc(msg)}</p>
       <p style="margin-top:14px"><a class="book" href="/">Back to search</a></p>
     </div></div>`;
}

/**
 * Result cards open this page in a new tab, so there is usually nothing to go "back"
 * to — following the link would start a blank search rather than returning to one.
 * Only offer going back when this tab actually has history; otherwise say "Search",
 * which is what the link really does.
 */
function syncBackLink() {
  const el = document.getElementById('back-link');
  if (!el) return;
  if (history.length > 1 && document.referrer.startsWith(location.origin)) {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      history.back();
    });
  } else {
    el.textContent = 'Search ↗';
  }
}

async function load() {
  syncBackLink();
  if (!ID) return fail('No listing selected', 'This page needs an ?id= parameter.');

  const q = new URLSearchParams({ checkIn: CHECK_IN, checkOut: CHECK_OUT, guests: GUESTS });
  if (CITY) q.set('city', CITY);
  if (LANDMARK) q.set('landmark', LANDMARK);
  let d;
  try {
    const res = await fetch(`/api/v1/hotel/${encodeURIComponent(ID)}?${q}`);
    d = await res.json();
    if (!res.ok) throw new Error(d.hint || d.message || `HTTP ${res.status}`);
  } catch (err) {
    return fail('Could not load this listing', err.message);
  }
  render(d);
}

function render(d) {
  document.title = `${d.name} — Tujia EN`;
  const m = d.location.nearestMetro;
  const stay = CHECK_IN && CHECK_OUT ? `${CHECK_IN} → ${CHECK_OUT}` : null;

  const parts = [];

  // ── gallery ────────────────────────────────────────────────────────────
  if (d.images.length) {
    parts.push(`<section class="gallery">
      ${d.images
        .slice(0, 9)
        .map(
          (src, i) =>
            `<a class="shot${i === 0 ? ' hero' : ''}" href="${esc(src)}" target="_blank" rel="noreferrer noopener">
               <img src="${esc(src)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" referrerpolicy="no-referrer">
             </a>`
        )
        .join('')}
      ${d.images.length > 9 ? `<span class="more-shots">+${d.images.length - 9} more</span>` : ''}
    </section>`);
  }

  // ── header ─────────────────────────────────────────────────────────────
  parts.push(`<section class="head">
    <div>
      <h1 class="title">${esc(d.name)}</h1>
      ${d.nameCn ? `<p class="title-cn" lang="zh-CN">${esc(d.nameCn)}</p>` : ''}
      ${
        d.nameOriginal && d.nameOriginal !== d.nameCn
          ? `<details class="orig-name"><summary>Tujia's full listing title</summary>
               <p lang="zh-CN">${esc(d.nameOriginal)}</p></details>`
          : ''
      }
      <p class="subhead">
        ${esc(d.layout.type)}${d.layout.areaSqm ? ` · ${d.layout.areaSqm} m²` : ''}
        ${d.location.districtEn ? ` · ${esc(d.location.districtEn)}` : ''}
        ${d.location.area ? ` · ${esc(d.location.area)}` : ''}
      </p>
      ${
        d.rating
          ? `<p class="rating-line">
               <strong>${d.rating}</strong>${d.ratingLabel ? ` ${esc(d.ratingLabel)}` : ''}
               · ${d.reviewCount} review${d.reviewCount === 1 ? '' : 's'}
             </p>`
          : ''
      }
    </div>
    <aside class="buy">
      ${
        // Anonymous session: Tujia masks the figure ("1??") rather than withholding
        // it, so the range below is exactly what it reveals — no guessing involved.
        d.price.masked && d.price.fromEUR != null
          ? `<div class="buy-price">
               <span class="now">€${d.price.fromEUR}–€${d.price.toEUR}</span><span class="per">/night</span>
             </div>
             <p class="buy-cny">¥${d.price.fromCNY}–${d.price.toCNY} approx${d.price.discountLabel ? ` · ${esc(d.price.discountLabel)}` : ''}</p>
             <p class="buy-stay">Tujia only shows exact prices to logged-in users.</p>`
          : `<div class="buy-price">
               ${d.price.originalEUR ? `<span class="was">€${d.price.originalEUR}</span>` : ''}
               <span class="now">${d.price.perNightEUR == null ? '—' : `€${d.price.perNightEUR}`}</span><span class="per">/night</span>
             </div>
             <p class="buy-cny">${d.price.perNightCNY == null ? 'price unavailable' : `¥${d.price.perNightCNY} CNY`}${d.price.discountLabel ? ` · ${esc(d.price.discountLabel)}` : ''}</p>`
      }
      ${stay ? `<p class="buy-stay">${esc(stay)}</p>` : ''}
      ${d.price.minNights && d.price.minNights > 1 ? `<p class="buy-stay">Minimum ${d.price.minNights} nights</p>` : ''}
      <a class="buy-btn" href="${esc(d.bookUrl)}" target="_blank" rel="noreferrer noopener">Book on Tujia ↗</a>
      <p class="buy-note">${d.price.bookable ? 'Available for these dates' : 'Not bookable for these dates'}</p>
    </aside>
  </section>`);

  // ── quick facts ────────────────────────────────────────────────────────
  if (d.layout.highlights.length || d.layoutRaw) {
    parts.push(`<section class="card-block">
      <h2>The space</h2>
      <div class="facts-grid">
        ${d.layout.highlights.map((h) => `<span class="fact-chip">${esc(h)}</span>`).join('')}
      </div>
      ${d.layoutRaw ? `<p class="raw-layout" lang="zh-CN" title="Tujia's own layout string">${esc(d.layoutRaw)}</p>` : ''}
    </section>`);
  }

  // ── location ───────────────────────────────────────────────────────────
  parts.push(`<section class="card-block">
    <h2>Location</h2>
    <p class="addr" lang="zh-CN">${esc(d.location.address)}</p>
    <ul class="loc-list">
      ${
        m
          ? `<li><span class="line-badge">${esc(m.lines.join(' · '))}</span>
               ${esc(m.station)} — ${km(m.distanceKm)}, ${m.walkMinutes} min walk</li>`
          : ''
      }
      ${
        d.location.distanceToLandmarkKm != null && d.location.landmark
          ? `<li class="fair">${d.location.distanceToLandmarkKm} km to the ${esc(d.location.landmark)}</li>`
          : ''
      }
    </ul>
    ${
      d.location.mapImageUrl
        ? `<img class="map" src="${esc(d.location.mapImageUrl)}" alt="Map of the area" loading="lazy" referrerpolicy="no-referrer">`
        : ''
    }
  </section>`);

  // ── amenities ──────────────────────────────────────────────────────────
  if (d.amenities.length) {
    parts.push(`<section class="card-block">
      <h2>What's here</h2>
      ${d.amenities
        .map(
          (g) => `<div class="amen-group">
            <h3>${esc(g.group)}</h3>
            <div class="amen-items">${g.items.map((i) => `<span class="chip" title="${esc(i.cn)}">${esc(i.en)}</span>`).join('')}</div>
          </div>`
        )
        .join('')}
      ${
        d.amenitiesUnavailable.length
          ? `<details class="missing">
               <summary>Not available here (${d.amenitiesUnavailable.length})</summary>
               <div class="amen-items">${d.amenitiesUnavailable.map((i) => `<span class="chip off" title="${esc(i.cn)}">${esc(i.en)}</span>`).join('')}</div>
             </details>`
          : ''
      }
    </section>`);
  }

  // ── rules ──────────────────────────────────────────────────────────────
  const allowed = d.rules.checkIn.filter((r) => r.allowed);
  const denied = d.rules.checkIn.filter((r) => !r.allowed);
  if (allowed.length || denied.length || d.rules.cancellation.length || d.rules.costs.length) {
    parts.push(`<section class="card-block">
      <h2>House rules &amp; policies</h2>
      ${
        allowed.length || denied.length
          ? `<div class="rules">
              ${allowed.map((r) => `<span class="rule yes" title="${esc(r.labelCn)}">✓ ${esc(r.label)}</span>`).join('')}
              ${denied.map((r) => `<span class="rule no" title="${esc(r.labelCn)}">✗ ${esc(r.label)}</span>`).join('')}
             </div>`
          : ''
      }
      ${
        d.rules.cancellation.length
          ? `<h3>Cancellation</h3>
             <ol class="timeline">
               ${d.rules.cancellation
                 .map(
                   (c) => `<li>
                     <span class="when">${esc(c.when)}</span>
                     ${c.note ? `<span class="note">${esc(c.note)}</span>` : ''}
                     ${c.partial ? `<span class="orig" lang="zh-CN" title="Original, shown because the translation is incomplete">${esc(c.whenCn)}${c.noteCn ? ' — ' + esc(c.noteCn) : ''}</span>` : ''}
                   </li>`
                 )
                 .join('')}
             </ol>`
          : ''
      }
      ${
        d.rules.costs.length
          ? `<h3>Fees</h3>
             <ul class="fees">
               ${d.rules.costs
                 .map(
                   (c) => `<li><strong>${esc(c.label)}</strong> ${esc(c.detail)}
                     ${c.partial ? `<span class="orig" lang="zh-CN">${esc(c.detailCn)}</span>` : ''}</li>`
                 )
                 .join('')}
             </ul>`
          : ''
      }
    </section>`);
  }

  // ── host ───────────────────────────────────────────────────────────────
  parts.push(`<section class="card-block host">
    <h2>Host</h2>
    <div class="host-row">
      ${d.host.logo ? `<img class="host-logo" src="${esc(d.host.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
      <div>
        <p class="host-name" lang="zh-CN">${esc(d.host.name)}</p>
        <div class="chips">${d.host.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
      </div>
    </div>
    ${
      d.host.stats.length
        ? `<ul class="host-stats">${d.host.stats.map((s) => `<li><span>${esc(s.label)}</span><strong>${esc(s.value)}</strong></li>`).join('')}</ul>`
        : ''
    }
    ${d.host.repliesWithin5Min ? '<p class="host-note">Usually replies within 5 minutes</p>' : ''}
  </section>`);

  // ── reviews ────────────────────────────────────────────────────────────
  if (d.reviewCount) {
    parts.push(`<section class="card-block">
      <h2>Reviews <span class="muted">${d.rating ?? ''} · ${d.reviewCount}</span></h2>
      ${
        d.subScores.length
          ? `<ul class="scores">${d.subScores.map((s) => `<li><span>${esc(s.name)}</span><strong>${s.score}</strong></li>`).join('')}</ul>`
          : ''
      }
      ${
        d.reviewTags.length
          ? `<div class="chips">${d.reviewTags.map((t) => `<span class="chip">${esc(t.label)} ${t.count}</span>`).join('')}</div>`
          : ''
      }
      ${
        d.reviews.length
          ? `<p class="cn-note">Tujia does not provide English review text, so the comments below are shown as written.</p>
             ${d.reviews
               .map(
                 (r) => `<article class="review">
                   <header>
                     <strong>${esc(r.author)}</strong>
                     ${r.score != null ? `<span class="rscore">${r.score}</span>` : ''}
                     <span class="rdate">${esc(r.date)}${r.stayLength ? ` · ${esc(r.stayLength)}` : ''}</span>
                   </header>
                   <p lang="zh-CN">${esc(r.text)}</p>
                 </article>`
               )
               .join('')}`
          : ''
      }
    </section>`);
  }

  document.getElementById('detail').innerHTML = parts.join('');
}

load();
