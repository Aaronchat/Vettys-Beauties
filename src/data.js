// Static game rules, costs, performer records, and asset locations.
const FACILITY_NAMES = ["Bar", "Main Stage", "VIP", "Private Dance Area", "DJ Booth", "Dressing Room", "Parking Lot"];
const CAPACITY = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };
const BUILDING_EXPENSES = {
  1: { tax: 100, operations: 500, advertising: 100, sheriff: 100 },
  2: { tax: 200, operations: 750, advertising: 150, sheriff: 150 },
  3: { tax: 400, operations: 1250, advertising: 250, sheriff: 250 },
  4: { tax: 750, operations: 2000, advertising: 400, sheriff: 400 },
  5: { tax: 1250, operations: 3500, advertising: 750, sheriff: 750 },
};
const SIGNING_FEE = 1000;
const TRAINING_COST = 5000;
const SAVE_KEY = "vettys-beauties-v01-save";
const AUSTIN_PURCHASE_PRICE = 500000;
const LOCATION_REGIONS = [
  { id: "north-america", name: "North America" },
];
const LOCATIONS = [
  { id: "belton", regionId: "north-america", city: "Belton", area: "Texas", displayName: "Belton, Texas", purchasePrice: 0, startingOwned: true },
  { id: "austin", regionId: "north-america", city: "Austin", area: "Texas", displayName: "Austin, Texas", purchasePrice: AUSTIN_PURCHASE_PRICE, startingOwned: false },
];
const RANKS = ["F", "E", "D", "C", "B", "A"];
const PAY_SHARES = { F: 0.20, E: 0.25, D: 0.30, C: 0.35, B: 0.40, A: 0.50 };
const RENEWAL_OFFERS = [
  { bonus: 1000, chance: 0.50 },
  { bonus: 2000, chance: 0.70 },
  { bonus: 3000, chance: 0.80 },
  { bonus: 4000, chance: 0.90 },
  { bonus: 5000, chance: 1.00 },
];
const PROPERTY_MANAGERS = [
  { id: "ted", name: "Ted", requiredBuildingLevel: 1, salary: 0, renewalBonus: 1000 },
  { id: "susan", name: "Susan", requiredBuildingLevel: 2, salary: 500, renewalBonus: 2000 },
  { id: "barbara", name: "Barbara", requiredBuildingLevel: 3, salary: 1000, renewalBonus: 3000 },
  { id: "myrtle", name: "Myrtle", requiredBuildingLevel: 4, salary: 2000, renewalBonus: 4000 },
  { id: "gertrude", name: "Gertrude", requiredBuildingLevel: 5, salary: 5000, renewalBonus: 5000 },
];
const PROMOTION_RESULTS = [-100, -75, -50, -25, 0, 25, 50, 75, 100];
const RANDOM_EVENT_CHANCE = 0.35;
const PROMOTION_CATEGORIES = [
  { key: "bar", label: "Bar", facility: "Bar", promotions: ["$1 Beers", "$3 Martinis"] },
  { key: "mainStage", label: "Main Stage", facility: "Main Stage", promotions: ["1/2 Price Entry Fee", "Amateur Night"] },
  { key: "vip", label: "VIP", facility: "VIP", promotions: ["1/2 Price Entry Fee", "Free Champagne"] },
  { key: "privateDance", label: "Private Dance", facility: "Private Dance Area", promotions: ["1/2 Off", "Don't Ask, Don't Tell Dances"] },
  { key: "dj", label: "DJ", facility: "DJ Booth", promotions: ["Professional DJ"] },
];
const ASSETS = {
  buildings: {
    1: "assets/buildings/neds-naughtiest-building-level-1.jpeg",
    2: "assets/buildings/neds-naughtiest-building-level-2.jpeg",
    3: "assets/buildings/neds-naughtiest-building-level-3.jpeg",
    4: "assets/buildings/neds-naughtiest-building-level-4.jpeg",
    5: "assets/buildings/neds-naughtiest-building-level-5.jpeg",
  },
  performers: {
    raven: "assets/performers/raven.jpeg",
    bambi: "assets/performers/bambi.jpeg",
    candy: "assets/performers/candy.jpeg",
    cherry: "assets/performers/cherry.jpeg",
    zella: "assets/performers/zella.jpeg",
    dallas: "assets/performers/dallas.jpeg",
    cinnamon: "assets/performers/cinnamon.jpeg",
    lola: "assets/performers/lola.jpeg",
  },
};
const PERFORMER_POOL = [
  { id: "raven", name: "Raven", concept: "Brunette bunny" },
  { id: "bambi", name: "Bambi", concept: "Blonde firefighter" },
  { id: "candy", name: "Candy", concept: "Blonde police officer" },
  { id: "cherry", name: "Cherry", concept: "Redheaded cheerleader" },
  { id: "zella", name: "Zella", concept: "Blonde schoolgirl" },
  { id: "dallas", name: "Dallas", concept: "Brunette cowgirl" },
  { id: "cinnamon", name: "Cinnamon", concept: "Brunette nurse" },
  { id: "lola", name: "Lola", concept: "Redheaded maid" },
];

const byId = id => PERFORMER_POOL.find(p => p.id === id);
