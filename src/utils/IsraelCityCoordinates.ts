// Coordinates for major Israeli cities and general world locations fallback
// Used for high-resolution mapping of user locations

export interface CityCoordinate {
    name: string;
    lat: number;
    lon: number;
}

export const ISRAEL_CITIES: Record<string, { lat: number, lon: number }> = {
    // Major Cities
    'Tel Aviv': { lat: 32.0853, lon: 34.7818 },
    'Jerusalem': { lat: 31.7683, lon: 35.2137 },
    'Haifa': { lat: 32.7940, lon: 34.9896 },
    'Rishon LeTsion': { lat: 31.9730, lon: 34.7925 },
    'Petah Tikva': { lat: 32.0840, lon: 34.8878 },
    'Ashdod': { lat: 31.8044, lon: 34.6553 },
    'Netanya': { lat: 32.3215, lon: 34.8532 },
    'Beer Sheva': { lat: 31.2518, lon: 34.7913 },
    'Bnei Brak': { lat: 32.0849, lon: 34.8352 },
    'Holon': { lat: 32.0158, lon: 34.7874 },
    'Ramat Gan': { lat: 32.0684, lon: 34.8264 },
    'Rehovot': { lat: 31.8928, lon: 34.8113 },
    'Bat Yam': { lat: 32.0162, lon: 34.7422 },
    'Ashkelon': { lat: 31.6690, lon: 34.5715 },
    'Herzliya': { lat: 32.1624, lon: 34.8447 },
    
    // Sharon Area
    'Kfar Saba': { lat: 32.1750, lon: 34.9069 },
    'Raanana': { lat: 32.1848, lon: 34.8713 },
    'Hod HaSharon': { lat: 32.1500, lon: 34.8833 },
    'Ramat HaSharon': { lat: 32.1499, lon: 34.8398 },

    // North
    'Nazareth': { lat: 32.6996, lon: 35.3035 },
    'Nahariya': { lat: 33.0031, lon: 35.0934 },
    'Akko': { lat: 32.9249, lon: 35.0827 },
    'Tiberias': { lat: 32.7944, lon: 35.5312 },
    'Afula': { lat: 32.6065, lon: 35.2881 },
    'Karmiel': { lat: 32.9199, lon: 35.2901 },
    'Safed': { lat: 32.9646, lon: 35.4960 }, // Tzfat
    'Kiryat Shmona': { lat: 33.2073, lon: 35.5682 },

    // Center / Gush Dan
    'Givatayim': { lat: 32.0715, lon: 34.8089 },
    'Kirjat Ono': { lat: 32.0626, lon: 34.8576 },
    'Kiryat Ono': { lat: 32.0626, lon: 34.8576 },
    'Or Yehuda': { lat: 32.0306, lon: 34.8546 },
    'Yehud': { lat: 32.0353, lon: 34.8872 },
    'Rosh HaAyin': { lat: 32.0956, lon: 34.9566 },
    'Elad': { lat: 32.0520, lon: 34.9515 },
    'Modiin': { lat: 31.8988, lon: 35.0104 },
    'Lod': { lat: 31.9525, lon: 34.8967 },
    'Ramla': { lat: 31.9292, lon: 34.8656 },
    'Yavne': { lat: 31.8780, lon: 34.7381 },
    'Ness Ziona': { lat: 31.9333, lon: 34.7997 },

    // South
    'Eilat': { lat: 29.5581, lon: 34.9482 },
    'Dimona': { lat: 31.0694, lon: 35.0340 },
    'Sderot': { lat: 31.5218, lon: 34.5956 },
    'Netivot': { lat: 31.4222, lon: 34.5951 },
    'Ofakim': { lat: 31.3142, lon: 34.6200 },
    'Kiryat Gat': { lat: 31.6034, lon: 34.7633 },
    
    // Special
    'Ben Gurion Airport': { lat: 32.0004, lon: 34.8706 },
    'TLV': { lat: 32.0004, lon: 34.8706 }
};

export const WORLD_COUNTRIES: Record<string, { lat: number, lon: number }> = {
    'United States': { lat: 37.0902, lon: -95.7129 },
    'UK': { lat: 55.3781, lon: -3.4360 },
    'France': { lat: 46.2276, lon: 2.2137 },
    'Germany': { lat: 51.1657, lon: 10.4515 },
    'Russia': { lat: 61.5240, lon: 105.3188 },
    'China': { lat: 35.8617, lon: 104.1954 },
    'Japan': { lat: 36.2048, lon: 138.2529 },
    'Australia': { lat: -25.2744, lon: 133.7751 },
    'Brazil': { lat: -14.2350, lon: -51.9253 },
    'Canada': { lat: 56.1304, lon: -106.3468 },
    'India': { lat: 20.5937, lon: 78.9629 },
    'Italy': { lat: 41.8719, lon: 12.5674 },
    'Spain': { lat: 40.4637, lon: -3.7492 },
    'Argentina': { lat: -38.4161, lon: -63.6167 },
    'South Africa': { lat: -30.5595, lon: 22.9375 },
    'South Korea': { lat: 35.9078, lon: 127.7669 },
    'Mexico': { lat: 23.6345, lon: -102.5528 }
};
