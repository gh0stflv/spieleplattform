// Wortlisten für Hangman, nach Sprache und Kategorie. Nur Buchstaben (A–Z, ÄÖÜ), Großschreibung egal.
export const WOERTER = {
  de: {
    Tiere: ["Elefant", "Giraffe", "Krokodil", "Schmetterling", "Eichhörnchen", "Pinguin", "Nashorn", "Känguru",
      "Papagei", "Delfin", "Fledermaus", "Igel", "Hummel", "Flamingo", "Koala", "Leopard", "Marienkäfer", "Otter",
      "Schildkröte", "Tintenfisch", "Walross", "Zebra", "Biber", "Dachs", "Faultier", "Gorilla", "Hirsch",
      "Kolibri", "Libelle", "Maulwurf", "Nilpferd", "Pfau", "Qualle", "Robbe", "Seepferdchen", "Wiesel"],
    Länder: ["Deutschland", "Frankreich", "Spanien", "Italien", "Portugal", "Niederlande", "Belgien", "Schweiz",
      "Österreich", "Polen", "Tschechien", "Ungarn", "Griechenland", "Türkei", "Norwegen", "Schweden", "Finnland",
      "Dänemark", "Island", "Irland", "Kanada", "Brasilien", "Argentinien", "Mexiko", "Japan", "China", "Indien",
      "Australien", "Neuseeland", "Ägypten", "Marokko", "Kenia", "Südafrika", "Thailand", "Vietnam", "Chile"],
    Essen: ["Spaghetti", "Bratwurst", "Käsekuchen", "Brezel", "Schnitzel", "Lebkuchen", "Apfelstrudel", "Pfannkuchen",
      "Kartoffelsalat", "Sauerkraut", "Gulasch", "Lasagne", "Pizza", "Sushi", "Burrito", "Hamburger", "Pommes",
      "Erdbeere", "Himbeere", "Blaubeere", "Banane", "Ananas", "Wassermelone", "Zitrone", "Mandarine", "Brokkoli",
      "Gurke", "Zucchini", "Aubergine", "Kürbis", "Schokolade", "Marmelade", "Honig", "Joghurt", "Müsli", "Waffel"],
    Berufe: ["Bäcker", "Feuerwehrmann", "Krankenschwester", "Zahnarzt", "Architektin", "Programmierer", "Pilotin",
      "Gärtner", "Schreiner", "Friseurin", "Lehrer", "Polizistin", "Koch", "Elektriker", "Mechaniker", "Apothekerin",
      "Bauarbeiter", "Journalist", "Richterin", "Schauspieler", "Tierärztin", "Astronaut", "Kapitän", "Förster",
      "Buchhalterin", "Detektiv", "Fotograf", "Musikerin", "Maler", "Schneiderin", "Metzger", "Dachdecker"],
    Sport: ["Fußball", "Handball", "Basketball", "Volleyball", "Tischtennis", "Badminton", "Schwimmen", "Leichtathletik",
      "Turnen", "Skifahren", "Snowboard", "Eishockey", "Biathlon", "Rudern", "Segeln", "Surfen", "Klettern",
      "Bogenschießen", "Fechten", "Judo", "Karate", "Boxen", "Ringen", "Reiten", "Radfahren", "Marathon",
      "Triathlon", "Golf", "Tennis", "Hockey", "Rugby", "Baseball", "Bowling", "Skateboard", "Tauchen", "Wandern"],
    Natur: ["Regenbogen", "Gewitter", "Schneeflocke", "Vulkan", "Wasserfall", "Gletscher", "Wüste", "Dschungel",
      "Sonnenblume", "Löwenzahn", "Tannenzapfen", "Kastanie", "Nordlicht", "Sternschnuppe", "Vollmond", "Tornado",
      "Hagel", "Nebel", "Lawine", "Erdbeben", "Korallenriff", "Sandstrand", "Quelle", "Moor", "Lichtung",
      "Felsen", "Insel", "Halbinsel", "Bucht", "Schlucht", "Höhle", "Steppe", "Savanne", "Tundra", "Oase", "Ozean"],
    Gegenstände: ["Regenschirm", "Taschenlampe", "Fernbedienung", "Kopfhörer", "Zahnbürste", "Schraubenzieher",
      "Kühlschrank", "Staubsauger", "Wasserkocher", "Bügeleisen", "Schlüsselbund", "Gießkanne", "Teppich",
      "Kerzenständer", "Briefkasten", "Fahrradhelm", "Rucksack", "Sonnenbrille", "Armbanduhr", "Geldbörse",
      "Lesebrille", "Nähmaschine", "Klavier", "Gitarre", "Trompete", "Schaukel", "Rutsche", "Sandkasten",
      "Zelt", "Kompass", "Fernglas", "Angelrute", "Thermoskanne", "Bleistift", "Radiergummi", "Lineal"],
  },
  en: {
    Animals: ["Elephant", "Giraffe", "Crocodile", "Butterfly", "Squirrel", "Penguin", "Rhinoceros", "Kangaroo",
      "Parrot", "Dolphin", "Hedgehog", "Bumblebee", "Flamingo", "Koala", "Leopard", "Ladybug", "Otter", "Turtle",
      "Octopus", "Walrus", "Zebra", "Beaver", "Badger", "Sloth", "Gorilla", "Hummingbird", "Dragonfly", "Mole",
      "Hippopotamus", "Peacock", "Jellyfish", "Seal", "Seahorse", "Weasel", "Raccoon", "Chameleon"],
    Countries: ["Germany", "France", "Spain", "Italy", "Portugal", "Netherlands", "Belgium", "Switzerland",
      "Austria", "Poland", "Hungary", "Greece", "Turkey", "Norway", "Sweden", "Finland", "Denmark", "Iceland",
      "Ireland", "Canada", "Brazil", "Argentina", "Mexico", "Japan", "China", "India", "Australia", "Egypt",
      "Morocco", "Kenya", "Thailand", "Vietnam", "Chile", "Scotland", "Croatia", "Indonesia"],
    Food: ["Spaghetti", "Pancake", "Cheesecake", "Pretzel", "Lasagna", "Pizza", "Sushi", "Burrito", "Hamburger",
      "Sandwich", "Strawberry", "Raspberry", "Blueberry", "Banana", "Pineapple", "Watermelon", "Lemon", "Broccoli",
      "Cucumber", "Zucchini", "Eggplant", "Pumpkin", "Chocolate", "Marmalade", "Honey", "Yogurt", "Waffle",
      "Doughnut", "Popcorn", "Avocado", "Mushroom", "Cinnamon", "Peanut", "Coconut", "Muffin", "Croissant"],
    Jobs: ["Baker", "Firefighter", "Nurse", "Dentist", "Architect", "Programmer", "Pilot", "Gardener", "Carpenter",
      "Hairdresser", "Teacher", "Police", "Chef", "Electrician", "Mechanic", "Pharmacist", "Builder", "Journalist",
      "Judge", "Actor", "Veterinarian", "Astronaut", "Captain", "Ranger", "Accountant", "Detective", "Photographer",
      "Musician", "Painter", "Tailor", "Butcher", "Plumber", "Librarian", "Scientist", "Farmer", "Lawyer"],
    Sports: ["Football", "Handball", "Basketball", "Volleyball", "Badminton", "Swimming", "Athletics", "Gymnastics",
      "Skiing", "Snowboard", "Hockey", "Biathlon", "Rowing", "Sailing", "Surfing", "Climbing", "Archery",
      "Fencing", "Judo", "Karate", "Boxing", "Wrestling", "Riding", "Cycling", "Marathon", "Triathlon", "Golf",
      "Tennis", "Rugby", "Baseball", "Bowling", "Skateboard", "Diving", "Hiking", "Cricket", "Lacrosse"],
    Nature: ["Rainbow", "Thunderstorm", "Snowflake", "Volcano", "Waterfall", "Glacier", "Desert", "Jungle",
      "Sunflower", "Dandelion", "Pinecone", "Chestnut", "Aurora", "Meteor", "Moonlight", "Tornado", "Hail", "Fog",
      "Avalanche", "Earthquake", "Reef", "Beach", "Spring", "Swamp", "Clearing", "Boulder", "Island", "Peninsula",
      "Bay", "Canyon", "Cave", "Prairie", "Savanna", "Tundra", "Oasis", "Ocean"],
    Objects: ["Umbrella", "Flashlight", "Remote", "Headphones", "Toothbrush", "Screwdriver", "Refrigerator",
      "Vacuum", "Kettle", "Iron", "Keychain", "Watering", "Carpet", "Candlestick", "Mailbox", "Helmet", "Backpack",
      "Sunglasses", "Wristwatch", "Wallet", "Glasses", "Sewing", "Piano", "Guitar", "Trumpet", "Swing", "Slide",
      "Sandbox", "Tent", "Compass", "Binoculars", "Fishing", "Thermos", "Pencil", "Eraser", "Ruler"],
  },
};

export const SPRACHEN = { de: "Deutsch", en: "English" };

/** Zufälliges Wort: { wort (groß), kategorie }. */
export function zufallsWort(sprache) {
  const kategorien = Object.keys(WOERTER[sprache]);
  const kategorie = kategorien[Math.floor(Math.random() * kategorien.length)];
  const liste = WOERTER[sprache][kategorie];
  return { wort: liste[Math.floor(Math.random() * liste.length)].toUpperCase(), kategorie };
}
