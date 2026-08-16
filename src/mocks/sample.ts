import { mapToEnglish } from '../services/mapper';
import item from './search-item.json';

/**
 * Runs the mapper over a real `data.items[0]` element captured from
 * search/v2/searchhouse/bnb, so field-name drift shows up here first.
 * Re-capture with the requests in requests.http when the payload changes.
 */
const hotel = mapToEnglish(item);
console.log(JSON.stringify(hotel, null, 2));
