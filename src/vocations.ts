
export function getVocationName(id: number) {
    switch (id) {
        case 0:
            return "None";
        case 1:
            return "Sorcerer";
        case 2:
            return "Druid";
        case 3:
            return "Paladin";
        case 4:
            return "Knight";
        case 5:
            return "Master Sorcerer";
        case 6:
            return "Elder Druid";
        case 7:
            return "Royal Paladin";
        case 8:
            return "Elite Knight";
    }
    return "Unknown";
}