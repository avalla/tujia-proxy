const DISTRICT_MAP: Record<string, string> = {
  // 行政区, taxonomy group 位置 > 行政区.
  // Guangzhou (city 45) ---------------------------------------------------
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
  // Shenzhen (city 49) ----------------------------------------------------
  // Two of these carry a legacy 新区 ("new district") suffix in Tujia's taxonomy even
  // though Shenzhen renamed them; both spellings are listed so either payload maps.
  '福田区': 'Futian',
  '南山区': 'Nanshan',
  '罗湖区': 'Luohu',
  '宝安区': "Bao'an",
  '龙岗区': 'Longgang',
  '龙华区': 'Longhua',
  '盐田区': 'Yantian',
  '坪山区': 'Pingshan',
  '光明区': 'Guangming',
  '光明新区': 'Guangming',
  '大鹏新区': 'Dapeng',
  '坪山新区': 'Pingshan',
  '龙华新区': 'Longhua',
  // Shanghai (city 23) -----------------------------------------------------
  // Only the ones pinyin gets wrong strictly need to be here (浦东新区 would become
  // "Pudongxin District", 静安区 loses its apostrophe), but listing the whole set
  // keeps a city's districts readable as a group.
  '黄浦区': 'Huangpu',
  '徐汇区': 'Xuhui',
  '长宁区': 'Changning',
  '静安区': "Jing'an",
  '普陀区': 'Putuo',
  '虹口区': 'Hongkou',
  '杨浦区': 'Yangpu',
  '闵行区': 'Minhang',
  '宝山区': 'Baoshan',
  '嘉定区': 'Jiading',
  '浦东新区': 'Pudong',
  '金山区': 'Jinshan',
  '松江区': 'Songjiang',
  '青浦区': 'Qingpu',
  '奉贤区': 'Fengxian',
  '崇明区': 'Chongming',
  // Beijing (city 48) ------------------------------------------------------
  '东城区': 'Dongcheng',
  '西城区': 'Xicheng',
  '朝阳区': 'Chaoyang',
  '丰台区': 'Fengtai',
  '石景山区': 'Shijingshan',
  '海淀区': 'Haidian',
  '门头沟区': 'Mentougou',
  '房山区': 'Fangshan',
  '通州区': 'Tongzhou',
  '顺义区': 'Shunyi',
  '昌平区': 'Changping',
  '大兴区': 'Daxing',
  '怀柔区': 'Huairou',
  '平谷区': 'Pinggu',
  '密云区': 'Miyun',
  '延庆区': 'Yanqing',
  // Chongqing (city 22) ----------------------------------------------------
  '渝中区': 'Yuzhong',
  '江北区': 'Jiangbei',
  '南岸区': "Nan'an",
  '九龙坡区': 'Jiulongpo',
  '沙坪坝区': 'Shapingba',
  '大渡口区': 'Dadukou',
  '北碚区': 'Beibei',
  '渝北区': 'Yubei',
  '巴南区': 'Banan',
  '两江新区': 'Liangjiang New Area',
  '万州区': 'Wanzhou',
  '涪陵区': 'Fuling',
  '长寿区': 'Changshou',
  '江津区': 'Jiangjin',
  '合川区': 'Hechuan',
  '永川区': 'Yongchuan',
  '南川区': 'Nanchuan',
  '綦江区': 'Qijiang',
  '大足区': 'Dazu',
  '璧山区': 'Bishan',
  '铜梁区': 'Tongliang',
  '潼南区': 'Tongnan',
  '荣昌区': 'Rongchang',
  '开州区': 'Kaizhou',
  '梁平区': 'Liangping',
  '武隆区': 'Wulong',
  '黔江区': 'Qianjiang',
  '城口县': 'Chengkou',
  '丰都县': 'Fengdu',
  '垫江县': 'Dianjiang',
  '忠县': 'Zhong County',
  '云阳县': 'Yunyang',
  '奉节县': 'Fengjie',
  '巫山县': 'Wushan',
  '巫溪县': 'Wuxi',
  '石柱县': 'Shizhu',
  '秀山县': 'Xiushan',
  '酉阳县': 'Youyang',
  '彭水县': 'Pengshui',
  // Chengdu (city 10) ------------------------------------------------------
  '锦江区': 'Jinjiang',
  '青羊区': 'Qingyang',
  '金牛区': 'Jinniu',
  '武侯区': 'Wuhou',
  '成华区': 'Chenghua',
  '龙泉驿区': 'Longquanyi',
  '青白江区': 'Qingbaijiang',
  '新都区': 'Xindu',
  '温江区': 'Wenjiang',
  '双流区': 'Shuangliu',
  '郫都区': 'Pidu',
  '新津区': 'Xinjin',
  '金堂县': 'Jintang',
  '大邑县': 'Dayi',
  '蒲江县': 'Pujiang',
  '都江堰': 'Dujiangyan',
  '彭州市': 'Pengzhou',
  '邛崃市': 'Qionglai',
  '崇州市': 'Chongzhou',
  '简阳市': 'Jianyang',
  // Hangzhou (city 7) ------------------------------------------------------
  '上城区': 'Shangcheng',
  '拱墅区': 'Gongshu',
  '西湖区': 'Xihu',
  '滨江区': 'Binjiang',
  '萧山区': 'Xiaoshan',
  '余杭区': 'Yuhang',
  '临平区': 'Linping',
  '钱塘区': 'Qiantang',
  '富阳区': 'Fuyang',
  '临安区': "Lin'an",
  '桐庐县': 'Tonglu',
  '淳安县': "Chun'an",
  '建德市': 'Jiande',
  // Xi'an (city 17) --------------------------------------------------------
  '新城区': 'Xincheng',
  '碑林区': 'Beilin',
  '莲湖区': 'Lianhu',
  '灞桥区': 'Baqiao',
  '未央区': 'Weiyang',
  '雁塔区': 'Yanta',
  '阎良区': 'Yanliang',
  '临潼区': 'Lintong',
  '长安区': "Chang'an",
  '高陵区': 'Gaoling',
  '鄠邑区': 'Huyi',
  '蓝田县': 'Lantian',
  '周至县': 'Zhouzhi',
  // Nanjing (city 9) -------------------------------------------------------
  '玄武区': 'Xuanwu',
  '秦淮区': 'Qinhuai',
  '建邺区': 'Jianye',
  '鼓楼区': 'Gulou',
  '浦口区': 'Pukou',
  '栖霞区': 'Qixia',
  '雨花台区': 'Yuhuatai',
  '江宁区': 'Jiangning',
  '六合区': 'Luhe',
  '溧水区': 'Lishui',
  '高淳区': 'Gaochun',
  // Suzhou (city 11) -------------------------------------------------------
  '姑苏区': 'Gusu',
  '虎丘区': 'Huqiu',
  '吴中区': 'Wuzhong',
  '相城区': 'Xiangcheng',
  '吴江区': 'Wujiang',
  '工业园区': 'Suzhou Industrial Park',
  '常熟市': 'Changshu',
  '张家港市': 'Zhangjiagang',
  '昆山市': 'Kunshan',
  '太仓市': 'Taicang',
  // bare forms, as they appear in some payloads
  '海珠': 'Haizhu',
  '天河': 'Tianhe',
  '番禺': 'Panyu',
  '越秀': 'Yuexiu',
  '琶洲': 'Pazhou',
  '福田': 'Futian',
  '南山': 'Nanshan',
  '罗湖': 'Luohu',
  '宝安': "Bao'an",
  '龙岗': 'Longgang',
  '龙华': 'Longhua',
  '盐田': 'Yantian',
  '坪山': 'Pingshan',
  '光明': 'Guangming',
  '大鹏': 'Dapeng',
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
  // ── detail-page facility vocabulary ────────────────────────────────────
  // Richer than the search filters; harvested from real gethouse/v3 responses.
  '暖气': 'Heating',
  '电热水壶': 'Electric kettle',
  '沙发': 'Sofa',
  '电吹风': 'Hair dryer',
  '牙具': 'Toothbrush kit',
  '浴巾': 'Bath towels',
  '毛巾': 'Towels',
  '电磁炉': 'Induction hob',
  '燃气灶': 'Gas hob',
  '晾衣架': 'Drying rack',
  '洗浴用品': 'Toiletries',
  '洗涤用品': 'Detergent',
  '餐具': 'Tableware',
  '餐桌': 'Dining table',
  '刀具菜板': 'Knives & chopping board',
  '烹饪锅具': 'Cookware',
  '电饭煲': 'Rice cooker',
  '烤箱': 'Oven',
  '净水机': 'Water purifier',
  '饮水机': 'Water dispenser',
  '加湿器': 'Humidifier',
  '电熨斗': 'Iron',
  '音响': 'Sound system',
  '投影设备': 'Projector',
  '巨幕投影': 'Big-screen projector',
  '窗户': 'Window',
  '观景落地窗': 'Panoramic windows',
  '观景天窗': 'Skylight',
  '江景': 'River view',
  // Shenzhen's taxonomy carries a coastal and a gaming filter Guangzhou's does not.
  '海景房': 'Sea view',
  '电竞房': 'Gaming room',
  // 洱海景 is Dali's lake, and shows up in Suzhou's taxonomy as a promoted filter.
  '洱海景': 'Erhai Lake view',
  // Tujia programme names, not amenities: 必住民宿 is its editorial pick badge and
  // 心服务 its service standard. Translated as labels rather than transliterated.
  '必住民宿': 'Editors’ pick',
  '心服务': 'Attentive service',
  '一次性拖鞋': 'Disposable slippers',
  '烧烤器具': 'BBQ equipment',
  '健身房': 'Gym',
  '跑步机': 'Treadmill',
  '儿童乐园': "Children's play area",
  '儿童玩具': "Children's toys",
  '读书品茶': 'Reading & tea corner',
  '管家式服务': 'Butler service',
  '付费接机/站': 'Paid airport/station pickup',
  '提供早餐': 'Breakfast available',
  '低楼层无电梯': 'Low floor, no elevator',
  // safety
  '火灾警报器': 'Smoke alarm',
  '灭火器': 'Fire extinguisher',
  '急救包': 'First-aid kit',
  '保安': 'Security staff',
  '门禁卡': 'Key-card access',
  '可视对讲': 'Video intercom',
  // air conditioning is reported per room
  '空调-冷暖': 'A/C (heating & cooling)',
  '卧室-空调': 'Bedroom A/C',
  '卧室-冷暖空调': 'Bedroom A/C (heating & cooling)',
  '卧室-制冷空调': 'Bedroom A/C (cooling)',
  '部分卧室-冷暖空调': 'Some bedrooms A/C (heating & cooling)',
  '部分卧室-制冷空调': 'Some bedrooms A/C (cooling)',
  '客厅-冷暖空调': 'Living-room A/C (heating & cooling)',
  // "nearby" entries in the neighbourhood group
  '超市': 'Supermarket nearby',
  '便利店': 'Convenience store nearby',
  '菜市场': 'Food market nearby',
  '餐厅': 'Restaurant nearby',
  '药店': 'Pharmacy nearby',
  '公园': 'Park nearby',
  '提款机': 'ATM nearby',
  // ── review tags (commentTagVo) ─────────────────────────────────────────
  '干净卫生': 'Clean',
  '环境好': 'Nice surroundings',
  '出行方便': 'Easy to get around',
  '下次还想入住': 'Would stay again',
  '设施挺好': 'Good facilities',
  '设施新': 'New facilities',
  '附近有地铁站': 'Metro station nearby',
  '服务态度好': 'Good service',
  '服务不错': 'Good service',
  '床上用品不错': 'Good bedding',
  '老板不错': 'Nice host',
  '老板热情': 'Welcoming host',
  '房间宽敞': 'Spacious room',
  '房间挺好': 'Nice room',
  '房间采光好': 'Bright room',
  '位置不错': 'Good location',
  '安静': 'Quiet',
  '有停车位': 'Parking available',
  '感觉很好': 'Felt great',
  // ── host tags (landlordModule) ─────────────────────────────────────────
  '自然人房东': 'Individual host',
  '实名验证': 'ID verified',
  // ── rules / costs ──────────────────────────────────────────────────────
  '商业拍摄': 'Commercial photography',
  '加人': 'Extra guests',
  '其他': 'Other',
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
  // host tag: 5套房屋 → "5 listings"
  [/^(\d+)套房屋$/, (m) => `${m[1]} listing${m[1] === '1' ? '' : 's'}`],
];

const PROPERTY_TYPE_MAP: Record<string, string> = {
  '别墅': 'Villa',
  '复式loft': 'Duplex loft',
  '别墅/loft': 'Villa / loft',
  '老洋房': 'Heritage house',
  '农家乐': 'Farm stay',
  '客栈': 'Guesthouse',
  '酒店式公寓': 'Serviced apartment',
  '普通公寓': 'Apartment',
  '庄园': 'Estate',
  '整套房屋': 'Entire place',
  '独立单间': 'Private room',
  '整栋/整院': 'Whole building or courtyard',
  '豪宅': 'Luxury home',
  // Regional property types that only appear outside Guangzhou/Shenzhen. 四合院 and
  // 吊脚楼 are specific vernacular forms, so they keep the Chinese term alongside the
  // gloss rather than being flattened to "courtyard house" / "stilt house".
  '四合院': 'Siheyuan courtyard house',
  '吊脚楼': 'Diaojiaolou stilt house',
  '木屋': 'Cabin',
  '石屋': 'Stone house',
  '泡泡屋': 'Bubble dome',
  '帐篷营地': 'Tent camp',
  '酒庄': 'Winery stay',
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

/** Facility group headings on the detail page (facilityModule → groupName). */
const FACILITY_GROUP_MAP: Record<string, string> = {
  服务: 'Services',
  设施: 'Facilities',
  厨房: 'Kitchen',
  卫浴: 'Bathroom',
  卧室: 'Bedroom',
  客厅: 'Living room',
  媒体娱乐: 'Media & entertainment',
  室外: 'Outdoor',
  安全: 'Safety',
  家电: 'Appliances',
  基础设施: 'Essentials',
  周边: 'Neighbourhood',
  儿童设施: 'Children',
  儿童: 'Children',
  基础: 'Essentials',
  休闲: 'Leisure',
  娱乐: 'Entertainment',
  其他: 'Other',
};

/** Review sub-score names (commentModule → subScores, "如实描述 4.9"). */
const SCORE_MAP: Record<string, string> = {
  如实描述: 'Accuracy',
  服务周到: 'Service',
  位置便利: 'Location',
  性价比: 'Value',
  卫生清洁: 'Cleanliness',
  设施设备: 'Facilities',
  舒适度: 'Comfort',
  安全度: 'Safety',
  高性价比: 'Value for money',
  入住便捷: 'Easy check-in',
  干净卫生: 'Cleanliness',
};

/** Check-in rule items (rulesModule → checkInRules[].items[].introduction). */
const RULE_MAP: Record<string, string> = {
  接待婴儿: 'Infants welcome',
  接待儿童: 'Children welcome',
  接待老人: 'Elderly guests welcome',
  接待海外: 'Overseas guests welcome',
  接待港澳台: 'HK/Macau/Taiwan guests welcome',
  带宠物: 'Pets',
  吸烟: 'Smoking',
  做饭: 'Cooking',
  聚会: 'Parties',
  入住须知: 'House rules',
  退改政策: 'Cancellation policy',
  费用须知: 'Fees & deposit',
  押金: 'Deposit',
  清洁费: 'Cleaning fee',
  加人费: 'Extra guest fee',
  其他费用: 'Other fees',
};

/** Landlord stat labels (landlordModule → hotelSummary[].title). */
const HOST_STAT_MAP: Record<string, string> = {
  好评率: 'Positive reviews',
  订单确认率: 'Booking confirmation rate',
  平均回复时间: 'Average reply time',
  房源数: 'Listings',
  入住率: 'Occupancy',
};

export const translateFacilityGroup = (cn: string): string => FACILITY_GROUP_MAP[cn] || cn;
export const translateHostStat = (cn: string): string => HOST_STAT_MAP[cn] || cn;

/** Rule/score labels fall back to the shared amenity vocabulary before giving up. */
export const translateRule = (cn: string): string => RULE_MAP[cn] || translateAmenity(cn);
export const translateScoreName = (cn: string): string => SCORE_MAP[cn] || translateAmenity(cn);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Cancellation timelines and fee notes are free text built from templates, with
 * Chinese dates inline (`入住前3天（10月07日 18:00）`). Translate the recognisable
 * phrases and date forms; anything unmatched is left as-is rather than mangled, and
 * callers keep the original so the UI can show it.
 */
// ORDER MATTERS: longer, more specific phrases must come before the generic anchors
// they contain, or e.g. 离店 fires inside 离店后原路退还 and destroys it. Clause
// replacements are space-padded; runs of spaces are collapsed at the end.
const POLICY_PHRASES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  // 1. dates, most specific form first: 10月10日24:00前 → before 24:00 on 10 Oct
  [
    /(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})前/g,
    (m) => ` before ${m[3]} on ${+m[2]} ${MONTHS[+m[1] - 1]} `,
  ],
  [/(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})/g, (m) => `${+m[2]} ${MONTHS[+m[1] - 1]}, ${m[3]}`],
  [/(\d{1,2})月(\d{1,2})日/g, (m) => `${+m[2]} ${MONTHS[+m[1] - 1]}`],
  [/(\d{1,2}):(\d{2})前/g, (m) => ` before ${m[1]}:${m[2]} `],

  // 2. multi-word clauses that embed an anchor word
  [/离店后原路退还/g, ' refunded to the original payment method after check-out '],
  [/之后取消订单将扣除全部房费/g, ' after that, cancelling forfeits the full amount '],
  [/取消订单可退还全部房费/g, ' cancel for a full refund '],
  [/取消订单将扣除首晚房费/g, ' cancelling forfeits the first night '],
  [/取消订单将扣除全部房费/g, ' cancelling forfeits the full amount '],
  [/入住前(\d+)天/g, (m) => `${m[1]} day${m[1] === '1' ? '' : 's'} before check-in`],
  [/标准入住(\d+)人/g, (m) => ` standard occupancy ${m[1]} guests `],
  [/无纠纷不扣押/g, ' not withheld if there are no disputes '],
  [/下单后入住前通过平台支付/g, ' paid through the platform after booking, before check-in '],
  [/下单时支付/g, ' paid at booking '],
  [/免押入住/g, ' no deposit required '],
  [/订房更轻松/g, ' easier booking '],
  [/请仔细阅读房东其他要求/g, " please read the host's other requirements carefully "],
  [/需要自带厨具/g, ' bring your own cookware '],
  [/厨房每次做完饭要自己洗碗呢?/g, ' wash your own dishes after cooking '],
  [/不收费拍摄/g, ' photography allowed, free of charge '],
  [/聚会需要自行收拾并恢复房间原状/g, ' after a party you must tidy up and restore the room '],
  [/夜间(\d+)点后不能制造噪音/g, (m) => ` no noise after ${m[1]}:00 `],
  [/可加(\d+)人/g, (m) => ` ${m[1]} extra guest${m[1] === '1' ? '' : 's'} allowed `],
  // Both ¥50/人晚 and ¥50/人/晚 occur in the wild.
  [/¥(\d+)\s*\/\s*人\s*\/?\s*晚/g, (m) => ` ¥${m[1]} per person per night `],
  [/不可加人/g, ' extra guests not allowed '],
  [/每人每晚/g, ' per person per night '],
  [/不可取消/g, ' non-refundable '],
  [/免费取消/g, ' free cancellation '],

  // 3. bare anchors last
  [/现在预订/g, 'Book now'],
  [/入住当天/g, 'On the check-in day'],
  [/入住后/g, 'After check-in'],
  [/离店/g, 'Check-out'],
  [/押金/g, 'deposit'],
  [/房费/g, 'room charge'],
];

/** Tujia's overall-rating word (commentModule → scoreTitle / scoreTitleV2). */
const RATING_LABEL_MAP: Record<string, string> = {
  超赞: 'Excellent',
  超棒: 'Superb',
  很好: 'Very good',
  棒: 'Great',
  好: 'Good',
  不错: 'Decent',
  一般: 'Average',
};
export const translateRatingLabel = (cn: string): string => RATING_LABEL_MAP[cn] || cn;

/** Reviewer display names and stay-length buckets are Chinese phrases, not numbers. */
const REVIEW_META_MAP: Record<string, string> = {
  匿名用户: 'Anonymous',
  住宿一晚: '1 night',
  小住几晚: 'a few nights',
  住宿约一周: 'about a week',
  住宿超一周: 'over a week',
  住宿数晚: 'several nights',
};
export const translateReviewMeta = (cn: string): string => REVIEW_META_MAP[cn] || cn;

/**
 * The four `houseSummary` chips on the detail page — dense, template-built strings
 * like `2卧室·1厅1卫1厨` or `2床·可住4人 · (可另加1人，¥50/人晚)`. Translated segment by
 * segment because no dictionary would cover the combinations.
 */
const SUMMARY_PATTERNS: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/可另加(\d+)人/g, (m) => `${m[1]} extra guest${m[1] === '1' ? '' : 's'} allowed`],
  [/¥(\d+)\s*\/\s*人\s*\/?\s*晚/g, (m) => `¥${m[1]} per person per night`],
  [/可住(\d+)人/g, (m) => `sleeps ${m[1]}`],
  // 2卧室·1厅1卫1厨 runs these together with no separator, so each emits its own comma.
  [/(\d+)卧室/g, (m) => `${m[1]} bedroom${m[1] === '1' ? '' : 's'}, `],
  [/(\d+)厅/g, (m) => `${m[1]} living room, `],
  [/(\d+)卫/g, (m) => `${m[1]} bathroom${m[1] === '1' ? '' : 's'}, `],
  [/(\d+)厨/g, (m) => `${m[1]} kitchen, `],
  [/(\d+)床/g, (m) => `${m[1]} bed${m[1] === '1' ? '' : 's'}`],
  [/㎡/g, ' m²'],
  [/(\d+)份早餐/g, (m) => `breakfast for ${m[1]}`],
  [/无早餐/g, 'No breakfast'],
  [/整套房屋/g, 'Entire place'],
  [/独立单间/g, 'Private room'],
  [/公共卫浴/g, 'Shared bathroom'],
  [/独立卫生间/g, 'Private bathroom'],
  [/复式/g, 'Duplex'],
  [/公寓/g, 'Apartment'],
  [/别墅/g, 'Villa'],
];

export function translateSummaryItem(cn: string): string {
  if (!cn) return '';
  let out = cn;
  for (const [re, rep] of SUMMARY_PATTERNS) {
    out = out.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpMatchArray;
      return typeof rep === 'function' ? rep(m) : rep;
    });
  }
  return out
    .replace(/·/g, ' · ')
    .replace(/（/g, ' (').replace(/）/g, ')')
    .replace(/，/g, ', ')
    .replace(/,\s*·/g, ' ·')      // trailing comma before a separator
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*·\s*/, '')
    .replace(/[,\s]+$/, '')       // trailing comma at the end
    .replace(/\s+([,.)])/g, '$1')
    .trim();
}

export function translatePolicyText(cn: string): string {
  if (!cn) return '';
  let out = cn;
  for (const [re, rep] of POLICY_PHRASES) {
    out = out.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpMatchArray;
      return typeof rep === 'function' ? rep(m) : rep;
    });
  }
  // Chinese punctuation → Latin, so the result reads as one sentence.
  return out
    .replace(/（/g, ' (').replace(/）/g, ')')
    .replace(/，/g, ', ').replace(/。/g, '. ').replace(/、/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.)])/g, '$1') // no space before punctuation
    .replace(/\(\s+/g, '(')
    .trim();
}

/** True when a string still holds CJK characters — used to flag partial translations. */
export const hasChinese = (s: string): boolean => /[一-鿿]/.test(s);

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
