const DISTRICT_MAP: Record<string, string> = {
  // 行政区, taxonomy group 位置 > 行政区
  '海珠区': 'Haizhu',
  '天河区': 'Tianhe',
  '番禺区': 'Panyu',
  '从化区': 'Conghua',
  '南沙区': 'Nansha',
  '增城区': 'Zengcheng',
  '白云区': 'Baiyun',
  '花都区': 'Huadu',
  '荔湾区': 'Liwan',
  '越秀区': 'Yuexiu',
  '黄埔区': 'Huangpu',
  // bare forms, as they appear in some payloads
  '海珠': 'Haizhu',
  '天河': 'Tianhe',
  '番禺': 'Panyu',
  '越秀': 'Yuexiu',
  '琶洲': 'Pazhou',
};

/**
 * Amenity / tag vocabulary.
 *
 * Two related but non-identical vocabularies are merged here:
 *  - filter labels from `conditions/fetch` (e.g. 免费停车位 = filter value 218)
 *  - unit tag labels from `houseTagsForCD[].text` (e.g. 付费停车位, 有洗衣机)
 * The tag form is often the filter form with 有 prefixed, so both spellings are listed.
 */
const AMENITY_MAP: Record<string, string> = {
  // parking / transport
  '免费停车位': 'Free parking',
  '付费停车位': 'Paid parking',
  '免费停车': 'Free parking',
  '充电桩': 'EV charging',
  '近地铁': 'Near metro',
  '接机接站': 'Airport/station pickup',
  '近高校': 'Near university',
  '地标建筑': 'Landmark building',
  '超市/菜场': 'Supermarket/market nearby',
  '周边有超市/菜市场': 'Supermarket/market nearby',
  // basics
  '免费wifi': 'Free WiFi',
  '无线网络': 'WiFi',
  '全天热水': '24h hot water',
  '空调': 'Air conditioning',
  '冷暖空调': 'Heating & cooling',
  '有暖气': 'Heating',
  '电视': 'TV',
  '冰箱': 'Refrigerator',
  '微波炉': 'Microwave',
  '洗衣机': 'Washing machine',
  '有洗衣机': 'Washing machine',
  '烘干机': 'Dryer',
  '吹风机': 'Hair dryer',
  '电梯': 'Elevator',
  '有电梯': 'Elevator',
  '智能门锁': 'Smart lock',
  '智能马桶': 'Smart toilet',
  '空气净化器': 'Air purifier',
  '热水': 'Hot water',
  '大床': 'Double bed',
  '落地窗': 'Floor-to-ceiling windows',
  '观景露台': 'View terrace',
  '阳光房': 'Sunroom',
  '浴缸': 'Bathtub',
  '有浴缸': 'Bathtub',
  '观景浴缸': 'View bathtub',
  '独立卫浴': 'Private bathroom',
  // kitchen / leisure
  '可做饭': 'Kitchen available',
  '麻将机': 'Mahjong table',
  'KTV': 'Karaoke',
  '游戏机': 'Games console',
  '桌游': 'Board games',
  '桌球': 'Pool table',
  '有投影': 'Projector',
  '有音箱': 'Sound system',
  '私家泳池': 'Private pool',
  '温泉': 'Hot spring',
  '私汤': 'Private hot spring',
  '休闲庭院': 'Courtyard',
  '烧烤撸串': 'BBQ facilities',
  '儿童娱乐区': "Children's play area",
  // services / policies
  '免费取消': 'Free cancellation',
  '立即确认': 'Instant confirmation',
  '行李寄存': 'Luggage storage',
  '前台接待': 'Front desk',
  '管家服务': 'Concierge service',
  '专业保洁清扫': 'Professional cleaning',
  '有早餐': 'Breakfast included',
  '免费瓶装水': 'Free bottled water',
  '平台开发票': 'Invoice available',
  '可开发票': 'Invoice available',
  '有保证金': 'Deposit required',
  '接待外宾': 'Accepts foreign guests',
  '港澳台客人适用': 'HK/Macau/Taiwan guests welcome',
  '可接待小孩': 'Children welcome',
  '可带宠物': 'Pets allowed',
  '携带宠物': 'Pets allowed',
  '禁烟房': 'Non-smoking',
  '吸烟房': 'Smoking allowed',
  '订多间': 'Multi-room booking',
  // quality / marketing
  '实拍看房': 'Real photos verified',
  '近2年装修': 'Renovated within 2 years',
  '优选民宿': 'Preferred stay',
  '严选民宿': 'Curated stay',
  '臻选民宿': 'Premium selection',
  '品牌民宿': 'Branded stay',
  '亲子精选': 'Family pick',
  // views / styles
  '江景房': 'River view',
  '湖景房': 'Lake view',
  '山景房': 'Mountain view',
  '河景房': 'Riverside view',
  '市景': 'City view',
  '复古风': 'Retro style',
  '中式风': 'Chinese style',
  '网红INS风': 'Instagram style',
  '侘寂风': 'Wabi-sabi style',
  '异域风': 'Exotic style',
  '欧美风': 'Western style',
  '现代风': 'Modern style',
  // guest impressions (点评 > 住客印象)
  '交通便利': 'Convenient transport',
  '干净舒心': 'Clean and comfortable',
  '贴心房东': 'Attentive host',
  '设施齐全': 'Well equipped',
  '环境安静': 'Quiet surroundings',
  '性价比高': 'Great value',
  '隔音好': 'Good soundproofing',
  // deals (优惠)
  '钻石会员价': 'Diamond member price',
  '房东直降': 'Host discount',
  '新房特惠': 'New listing deal',
  '早订优惠': 'Early-bird deal',
  '周租特惠': 'Weekly-stay deal',
  '连住优惠': 'Multi-night discount',
};

/**
 * Patterned labels Tujia generates rather than picks from a fixed vocabulary.
 * Checked before the dictionary falls through to returning the original.
 */
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^([\d.]+)分以上$/, (m) => `${m[1]}+ rating`],
  [/^(\d+)\+点评$/, (m) => `${m[1]}+ reviews`],
  [/^(\d+)一口价$/, (m) => `¥${m[1]} flat rate`],
  [/^(\d+)人$/, (m) => `${m[1]} guest${m[1] === '1' ? '' : 's'}`],
  [/^(\d+)居$/, (m) => `${m[1]} bedroom${m[1] === '1' ? '' : 's'}`],
  [/^(\d+)床$/, (m) => `${m[1]} bed${m[1] === '1' ? '' : 's'}`],
  [/^连住优惠减(\d+)$/, (m) => `¥${m[1]} off multi-night stays`],
  [/^钻石会员减(\d+)$/, (m) => `¥${m[1]} diamond member discount`],
];

const PROPERTY_TYPE_MAP: Record<string, string> = {
  '别墅': 'Villa',
  '复式loft': 'Duplex loft',
  '老洋房': 'Heritage house',
  '农家乐': 'Farm stay',
  '客栈': 'Guesthouse',
  '酒店式公寓': 'Serviced apartment',
  '普通公寓': 'Apartment',
  '庄园': 'Estate',
  '整套房屋': 'Entire place',
  '独立单间': 'Private room',
};

export const translateDistrict = (cn: string): string => DISTRICT_MAP[cn] || cn;
export const translatePropertyType = (cn: string): string => PROPERTY_TYPE_MAP[cn] || cn;

/**
 * Translate any Tujia label: amenity, property type, deal, or generated pattern.
 * Returns the original string when nothing matches, so callers can detect misses.
 */
export function translateAmenity(cn: string): string {
  const direct = AMENITY_MAP[cn] || PROPERTY_TYPE_MAP[cn];
  if (direct) return direct;
  for (const [re, render] of PATTERNS) {
    const m = cn.match(re);
    if (m) return render(m);
  }
  return cn;
}

export interface Occupancy {
  bedrooms: number | null;
  doubleBeds: number | null;
  singleBeds: number | null;
  maxGuests: number | null;
}

/**
 * Parse a CANLIVEDESC summary, e.g.
 *   "2居2大床4人"          -> 2 bedrooms, 2 double beds, 4 guests
 *   "1大床2人"             -> 1 double bed, 2 guests (studio, no 居 segment)
 *   "1居1大床1单人床3-4人"  -> 1 bedroom, 1 double + 1 single, 4 guests (upper bound)
 */
export function parseOccupancy(text: string): Occupancy {
  const num = (re: RegExp): number | null => {
    const m = text.match(re);
    return m ? parseInt(m[1], 10) : null;
  };
  // guest count may be a range ("3-4人"); take the upper bound
  const guests = text.match(/(\d+)(?:-(\d+))?人/);
  return {
    bedrooms: num(/(\d+)居/),
    doubleBeds: num(/(\d+)大床/),
    singleBeds: num(/(\d+)单人床/),
    maxGuests: guests ? parseInt(guests[2] || guests[1], 10) : null,
  };
}

export interface Layout {
  entirePlace: boolean;
  typeEn: string;
  areaSqm: number | null;
}

/**
 * Parse a HOUSELEVEL summary, e.g. "整套28㎡" or "单间13㎡".
 */
export function parseLayout(text: string): Layout {
  const entirePlace = text.includes('整套');
  const area = text.match(/(\d+(?:\.\d+)?)\s*㎡/);
  return {
    entirePlace,
    typeEn: entirePlace ? 'Entire apartment' : text.includes('单间') ? 'Private room' : 'Room',
    areaSqm: area ? parseFloat(area[1]) : null,
  };
}
