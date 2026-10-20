# Product

## Register

product

## Users

Foreign visitors to China who do not read Chinese and need somewhere to stay, most often near a trade fair (the Canton Fair in Guangzhou, the Shenzhen World shows) or a specific part of a city. They usually search a few weeks ahead, on a laptop and on a phone. Tujia itself is Chinese-only and assumes local knowledge (districts, metro lines, which hosts may legally take foreign guests), which is exactly what they lack.

## Product Purpose

An English front end over Tujia's short-term rentals. The job is "find a place I can actually book, that foreigners are allowed to stay in, close enough to where I need to be". Success is a visitor who goes from city and dates to a short list of good, reachable listings without needing to understand Tujia's Chinese taxonomy.

## Brand Personality

Calm, clear, trustworthy. In the lane of Airbnb rather than Booking: photos and a few essential choices up front, everything else available but out of the way. Honest about what it cannot do (masked prices on anonymous sessions, untranslated reviews) instead of hiding it.

## Anti-references

- Chinese OTA clutter: every filter visible at once, promo strips, keyword-spam titles (inferred from the repo, where raw Tujia titles are deliberately replaced by synthesized English headlines).
- A long sidebar of form controls where the one action (Search) is hard to find.

## Design Principles

1. **Essentials first, the rest on request.** City, dates and guests are the trip; everything else is a refinement and is disclosed progressively.
2. **Speak the visitor's geography.** Distances to the place they are going and walk times to metro lines, not Tujia's district ids.
3. **Never pretend.** Ranges for masked prices, Chinese originals kept beside synthesized English, a plain sentence when a filter cannot apply.
4. **Sensible defaults for foreigners.** Accept foreign guests on, a one-week stay from today, the city's main venue as the distance anchor.

## Accessibility & Inclusion

WCAG 2.2 AA (the repo already tunes muted text to the AA threshold in both themes). Light and dark themes follow the OS. Touch targets at least 44px on phones, 16px inputs so iOS does not zoom, reduced motion respected.
