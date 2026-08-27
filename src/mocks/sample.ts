import { mapToEnglish, mapContext } from '../services/mapper';
import item from './search-item.json';

/**
 * Runs the mapper over a real `data.items[0]` element captured from
 * search/v2/searchhouse/bnb, so field-name drift shows up here first.
 * Re-capture with the requests in requests.http when the payload changes.
 *
 * The fixture is a Guangzhou unit, so the context is pinned to city 45 — the nearest
 * station and Canton Fair distance below are only meaningful against that catalog.
 */
const hotel = mapToEnglish(item, mapContext('45'));
console.log(JSON.stringify(hotel, null, 2));
