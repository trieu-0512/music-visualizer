from __future__ import annotations

import csv
import json
import random
import shutil
from dataclasses import dataclass
from pathlib import Path

from audit_abc_song_catalog import audit_catalog, write_reports

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "abc-song"
LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


@dataclass(frozen=True)
class DomainSpec:
    macro_domain: str
    themes: tuple[str, str, str, str, str]
    pairs: tuple[tuple[str, str], ...]


def _pairs(raw: str) -> tuple[tuple[str, str], ...]:
    values: list[tuple[str, str]] = []
    for item in raw.split(";"):
        left, right = (part.strip() for part in item.split("~", 1))
        values.append((left, right))
    if len(values) != 26:
        raise ValueError(f"Expected 26 letter pairs, got {len(values)}")
    return tuple(values)


def domain(name: str, themes: list[str], raw_pairs: str) -> DomainSpec:
    if len(themes) != 5:
        raise ValueError(f"{name}: expected 5 themes")
    return DomainSpec(name, tuple(themes), _pairs(raw_pairs))  # type: ignore[arg-type]


# Five balanced binary codewords. Each song in a macro-domain chooses a
# different mix of two genuine thematic candidates per letter. We search a
# deterministic codebook whose pairwise Hamming distance is >=14, which keeps
# same-domain exact-object Jaccard well below the 0.40 hard gate.
def _build_patterns() -> tuple[tuple[int, ...], ...]:
    rng = random.Random(20260808)
    patterns: list[tuple[int, ...]] = []
    attempts = 0
    while len(patterns) < 5 and attempts < 100000:
        attempts += 1
        bits = [0] * 13 + [1] * 13
        rng.shuffle(bits)
        candidate = tuple(bits)
        if candidate in patterns:
            continue
        if all(sum(a != b for a, b in zip(candidate, existing)) >= 14 for existing in patterns):
            patterns.append(candidate)
    if len(patterns) != 5:
        raise RuntimeError("Could not build a sufficiently separated mapping codebook")
    return tuple(patterns)


PATTERNS = _build_patterns()


DOMAINS: tuple[DomainSpec, ...] = (
    domain("Ocean & Coast", ["Ocean Animals & Coast", "Sea Life & Shores", "Ocean Creatures & Boats", "Ocean Nature & Travel", "Coast Explorer"],
           "Anchor~Angelfish;Boat~Buoy;Coral~Crab;Dolphin~Dock;Eel~Estuary;Fish~Flipper;Gull~Grouper;Harbor~Hermit Crab;Island~Isopod;Jellyfish~Jetty;Kelp~Kayak;Lobster~Lagoon;Manatee~Mussel;Nautilus~Narwhal;Octopus~Oyster;Pelican~Pufferfish;Queen Angelfish~Quahog;Ray~Reef;Seahorse~Seal;Turtle~Tidepool;Urchin~Undersea Cave;Vessel~Violet Sea Snail;Whale~Wave;X-ray Tetra~X-ray Fish;Yellow Tang~Yellowfin Tuna;Zebra Shark~Zooplankton"),
    domain("Freshwater", ["Pond & River Life", "Lakes & Waterways", "Freshwater Animals", "Wetland Nature", "Riverbank Explorer"],
           "Alligator~Alder;Beaver~Boat;Catfish~Canoe;Duck~Dam;Eel~Egret;Frog~Fishing Rod;Goose~Green Algae;Heron~Hydrilla;Iris~Insect;Jetty~June Bug;Kayak~Kingfisher;Lily Pad~Lake;Minnow~Muskrat;Newt~Nest;Otter~Oar;Pond~Pike;Quail~Quillwort;Reed~River;Salamander~Swan;Trout~Tadpole;Umbrella Sedge~Underwater Plant;Valley~Vallisneria;Waterfall~Water Lily;X-ray Tetra~Xiphophorus;Yellow Perch~Yellow Water Lily;Zebra Danio~Zooplankton"),
    domain("Farm & Barn", ["Farm Animals", "Barn & Fields", "Farm Tools & Crops", "Country Farm Life", "Harvest & Orchard"],
           "Apple~Apron;Barn~Bucket;Cow~Chicken;Duck~Donkey;Egg~Ewe;Fence~Farmer;Goat~Grain;Hay~Hen;Irrigation Pump~Ice Chest;Jar~Jug;Kernel~Kid Goat;Lamb~Ladder;Milk~Mule;Nest~Nectarine;Ox~Orchard;Pig~Pitchfork;Quilt~Quail;Rooster~Rake;Scarecrow~Sheep;Tractor~Trough;Udder~Utility Cart;Vegetable Basket~Vet Kit;Wagon~Wheat;Xylophone~X-ray Vet Image;Yarn~Yam;Zucchini~Zebu"),
    domain("Garden & Plants", ["Garden Plants", "Flowers & Bugs", "Garden Equipment", "Vegetables & Seeds", "Backyard Garden"],
           "Apron~Apple Tree;Bee~Bean;Carrot~Compost;Daisy~Dirt;Eggplant~Earthworm;Flower~Fern;Garden Hose~Garden Gate;Hoe~Herb;Ivy~Iris;Jasmine~Jug;Kale~Kneeling Pad;Ladybug~Lavender;Marigold~Mulch;Nest~Nasturtium;Onion~Orchid;Pea~Pot;Quince~Quail;Rose~Radish;Sunflower~Seed;Tomato~Trowel;Umbrella~Umbrella Plant;Violet~Vegetable Bed;Watering Can~Worm;Xylophone~Xeranthemum;Yam~Yarrow;Zucchini~Zinnia"),
    domain("Forest & Woodland", ["Woodland Animals", "Trees & Forest Floor", "Forest Birds & Plants", "Woodland Explorer", "Autumn Forest"],
           "Acorn~Aspen;Bear~Birch;Cedar~Chipmunk;Deer~Douglas Fir;Evergreen~Eagle;Fox~Fern;Grass~Grouse;Hedgehog~Hollow Log;Ivy~Insect;Jay~Juniper;Kingfisher~Knot;Log~Lynx;Mushroom~Maple;Nest~Newt;Owl~Oak;Pinecone~Pine;Quail~Quartz Rock;Rabbit~River;Squirrel~Spruce;Tree~Trail;Underbrush~Upland Fern;Violet~Vine;Woodpecker~Wolf;Xylophone~Xeric Shrub;Yew~Yellow Warbler;Zinnia~Zebra Swallowtail"),
    domain("Jungle & Rainforest", ["Rainforest Animals", "Tropical Jungle", "Jungle Plants & Creatures", "Rainforest Explorer", "Canopy & River"],
           "Anaconda~Anteater;Banana~Boa;Chameleon~Ceiba Tree;Dragonfly~Drongo;Elephant~Emerald Tree Boa;Fern~Frog;Gorilla~Gecko;Hornbill~Howler Monkey;Iguana~Insect;Jaguar~Jungle Vine;Kapok Tree~Kinkajou;Leopard~Liana;Monkey~Macaw;Nest~Nectar Bat;Orchid~Ocelot;Parrot~Palm;Quetzal~Queen Butterfly;Rainforest Frog~Rattan;Snake~Sloth;Toucan~Tapir;Umbrella Leaf~Uakari;Vine~Viper;Waterfall~Water Vine;Xylophone~Xenops;Yellow Butterfly~Yellow Anaconda;Zebra Longwing~Zingiber Plant"),
    domain("Desert", ["Desert Animals", "Cactus & Dunes", "Desert Plants & Rocks", "Desert Explorer", "Oasis & Wildlife"],
           "Armadillo~Agave;Beetle~Bighorn Sheep;Cactus~Camel;Dune~Desert Tortoise;Eagle~Euphorbia;Fox~Fennec;Gecko~Gila Monster;Hawk~Horned Lizard;Ibex~Iguana;Jackrabbit~Joshua Tree;Kangaroo Rat~Kestrel;Lizard~Limestone;Meerkat~Mesquite;Nighthawk~Nopales;Oryx~Oasis;Prickly Pear~Palm;Quail~Quartz;Roadrunner~Rattlesnake;Scorpion~Sand;Tortoise~Tumbleweed;Urial~Umbrella Thorn;Vulture~Viper;Wren~Wadi;Xerus~Xerophyte;Yucca~Yellow Scorpion;Zebra Finch~Ziziphus Shrub"),
    domain("Arctic & Polar", ["Polar Animals", "Ice & Tundra", "Frozen Ocean", "Arctic Explorer", "Snowy Wildlife"],
           "Arctic Fox~Auk;Beluga~Bear;Caribou~Cod;Dog Sled~Dovekie;Eider~Ermine;Fur Seal~Floe;Goose~Glacier;Harp Seal~Husky;Iceberg~Icefish;Jaeger~Jellyfish;Krill~Kittiwake;Lemming~Lynx;Musk Ox~Murre;Narwhal~Northern Fulmar;Orca~Owl;Polar Bear~Puffin;Qajaq~Quartz;Reindeer~Ringed Seal;Snowy Owl~Seal;Tundra~Tern;Umiak~Upland Goose;Vole~Velvet Scoter;Walrus~Whale;Xylophone~X-ray Fish;Yak~Yellow-billed Loon;Zooplankton~Zoarcid Fish"),
    domain("Mountains", ["Mountain Animals", "Peaks & Valleys", "Alpine Nature", "Mountain Explorer", "Trails & Glaciers"],
           "Alpine Goat~Aspen;Boulder~Bighorn Sheep;Cliff~Cabin;Deer~Douglas Fir;Eagle~Edelweiss;Fir~Falcon;Goat~Glacier;Hawk~Hiking Boot;Ibex~Icefall;Jay~Juniper;Kestrel~Kettle Lake;Ledge~Lynx;Marmot~Mountain;Nutcracker~Nest;Owl~Outcrop;Pine~Pika;Quartz~Quail;Ridge~Rope;Summit~Snow;Trail~Tent;Upland Meadow~Urial;Valley~Vulture;Waterfall~Wolf;Xylophone~Xeric Shrub;Yak~Yellow Bell;Zinnia~Zigzag Trail"),
    domain("Weather & Sky", ["Weather Watch", "Sky & Clouds", "Weather Gear", "Wind Rain & Snow", "Weather Station"],
           "Anemometer~Altocumulus;Boots~Breeze;Cloud~Coat;Drizzle~Dew;Earmuffs~Eye of Storm;Fog~Frost;Gauge~Gust;Hail~Humidity Meter;Ice~Icicle;Jacket~Jet Stream;Kite~Kelvin Thermometer;Lightning~Low Cloud;Mittens~Mist;Nimbus Cloud~Night Sky;Overcoat~Overcast Sky;Puddle~Pressure Gauge;Quilt~Quiet Sky;Raincoat~Rainbow;Snowflake~Sun;Thermometer~Thunder;Umbrella~Updraft;Vane~Vapor;Windsock~Wind;Xylophone~X-band Radar;Yellow Rain Boots~Yellow Sun;Zipper Jacket~Zephyr"),
    domain("Space & Astronomy", ["Space Explorer", "Planets & Stars", "Rockets & Astronauts", "Moon & Galaxy", "Space Science"],
           "Astronaut~Asteroid;Booster~Black Hole;Comet~Capsule;Dish Antenna~Dwarf Planet;Earth~Eclipse;Flag~Fuel Tank;Galaxy~Gemini Capsule;Helmet~Hubble Telescope;International Space Station~Io;Jupiter~Jet Pack;Kuiper Belt~Krypton Tank;Lander~Lunar Rover;Moon~Meteor;Nebula~Neptune;Orbit~Observatory;Planet~Probe;Quasar~Quarter Moon;Rocket~Rover;Satellite~Spacesuit;Telescope~Thruster;Universe~Uranus;Venus~Visor;World~White Dwarf;X-ray Telescope~Xenon Thruster;Yellow Star~Yoke;Zodiac Chart~Zero-gravity Chair"),
    domain("Dinosaurs & Fossils", ["Dinosaur World", "Fossils & Bones", "Prehistoric Life", "Dinosaur Explorer", "Museum of Dinosaurs"],
           "Allosaurus~Ankylosaurus;Brachiosaurus~Bone;Ceratopsian~Carnotaurus;Diplodocus~Deinonychus;Egg~Edmontosaurus;Fossil~Footprint;Giganotosaurus~Gastonia;Hadrosaur~Herrerasaurus;Iguanodon~Irritator;Jurassic Fern~Jawbone;Kentrosaurus~Kritosaurus;Lesothosaurus~Lambeosaurus;Mosasaurus~Maiasaura;Nest~Nodosaurus;Oviraptor~Ornithomimus;Pteranodon~Pachycephalosaurus;Quetzalcoatlus~Qianzhousaurus;Raptor~Rib Bone;Stegosaurus~Spinosaurus;Triceratops~Tyrannosaurus;Utahraptor~Unenlagia;Velociraptor~Volcano;Wuerhosaurus~Wannanosaurus;Xenoceratops~Xixiasaurus;Yutyrannus~Yinlong;Zuniceratops~Zephyrosaurus"),
    domain("Insects & Bugs", ["Bug World", "Butterflies & Beetles", "Garden Insects", "Tiny Creatures", "Insect Explorer"],
           "Ant~Aphid;Bee~Beetle;Caterpillar~Cricket;Dragonfly~Dung Beetle;Earwig~Emperor Moth;Firefly~Flea;Grasshopper~Gnat;Honeybee~Hercules Beetle;Inchworm~Insect;June Bug~Jewel Beetle;Katydid~Kissing Bug;Ladybug~Leafhopper;Mantis~Mosquito;Net-winged Beetle~Nymph;Orange Butterfly~Orb Weaver;Praying Mantis~Pill Bug;Queen Bee~Queen Butterfly;Roach~Rhinoceros Beetle;Stick Insect~Stag Beetle;Termite~Tiger Moth;Underwing Moth~Ulysses Butterfly;Vinegar Fly~Viceroy Butterfly;Wasp~Weevil;Xylophone Beetle~Xylocopa Bee;Yellowjacket~Yellow Butterfly;Zebra Butterfly~Zebra Longwing"),
    domain("Birds", ["Bird World", "Feathers & Nests", "Backyard Birds", "Water & Land Birds", "Birdwatching"],
           "Albatross~Avocet;Bluebird~Budgie;Cardinal~Crane;Duck~Dove;Eagle~Egret;Finch~Flamingo;Goose~Goldfinch;Heron~Hummingbird;Ibis~Indian Roller;Jay~Junco;Kingfisher~Kiwi;Lark~Lorikeet;Macaw~Magpie;Nuthatch~Nest;Owl~Ostrich;Parrot~Penguin;Quail~Quetzal;Robin~Raven;Sparrow~Swan;Toucan~Tern;Umbrellabird~Upland Sandpiper;Vulture~Veery;Woodpecker~Wren;Xenops~Xantus Hummingbird;Yellowhammer~Yellow Warbler;Zebra Finch~Zenaida Dove"),
    domain("Pets", ["Pet Care", "Home Pets", "Pet Playtime", "Small Animal Friends", "Pet Shop Day"],
           "Aquarium~Angelfish;Bunny~Bowl;Cat~Collar;Dog~Doghouse;Exercise Wheel~Ear Cleaner;Fish~Feather Toy;Guinea Pig~Grooming Brush;Hamster~Hutch;Iguana~ID Tag;Jumping Toy~Jingle Ball;Kitten~Kibble;Leash~Litter Box;Mouse~Meal Bowl;Nest~Nail Clipper;Octopus Toy~Outdoor Kennel;Puppy~Perch;Quail~Quilt Bed;Rabbit~Rope Toy;Scratching Post~Seed Mix;Turtle~Treat;Undercoat Brush~UV Lamp;Vet Kit~Vest Harness;Water Bowl~Wheel;Xylophone Toy~X-ray Vet Image;Yarn Ball~Yellow Canary;Zebra Finch~Zip Carrier"),
    domain("Zoo & Safari", ["Zoo Animals", "Safari Wildlife", "Animal Habitats", "Wild Animal World", "Zoo Explorer"],
           "Antelope~Ape;Baboon~Bison;Cheetah~Camel;Deer~Dhole;Elephant~Emu;Flamingo~Fox;Giraffe~Gorilla;Hippo~Hyena;Ibex~Iguana;Jaguar~Jackal;Kangaroo~Koala;Lion~Lemur;Monkey~Meerkat;Nyala~Nile Crocodile;Okapi~Ostrich;Panda~Puma;Quokka~Quail;Rhino~Red Panda;Seal~Serval;Tiger~Tapir;Urial~Uakari;Vulture~Vicuna;Wolf~Walrus;Xerus~Xenopus;Yak~Yellow Mongoose;Zebra~Zebu"),
    domain("Reptiles & Amphibians", ["Reptile & Amphibian World", "Frogs Snakes & Turtles", "Scales & Slime", "Cold-Blooded Creatures", "Reptile House"],
           "Alligator~Axolotl;Boa~Bullfrog;Chameleon~Crocodile;Dart Frog~Dragon Lizard;Eastern Newt~Emerald Tree Boa;Frog~Frilled Lizard;Gecko~Garter Snake;Horned Lizard~Hellbender;Iguana~Italian Newt;Jackson Chameleon~Jumping Frog;King Cobra~Komodo Dragon;Lizard~Leopard Gecko;Monitor Lizard~Mudpuppy;Newt~Nile Crocodile;Olive Python~Ornate Box Turtle;Python~Poison Frog;Queen Snake~Queensland Frog;Rattlesnake~Red-eyed Tree Frog;Salamander~Skink;Toad~Turtle;Uromastyx~Urutu Snake;Viper~Veiled Chameleon;Water Dragon~Wood Frog;Xenopus~Xenosaurus;Yellow Anaconda~Yellow-bellied Slider;Zebra Skink~Zigzag Salamander"),
    domain("Food & Kitchen", ["Kitchen & Food", "Cooking Tools & Ingredients", "Meals & Snacks", "Cooking Together", "Tasty Kitchen"],
           "Apron~Apple;Bowl~Blender;Cup~Cutting Board;Dish~Donut;Egg~Egg Timer;Fork~Frying Pan;Grater~Grapes;Honey~Hot Pot;Ice Tray~Ice Cream;Jar~Juicer;Kettle~Knife;Ladle~Lemon;Mixer~Muffin;Noodles~Napkin;Oven~Orange;Pan~Pancake;Quiche~Quart Cup;Rice~Rolling Pin;Spoon~Spatula;Toast~Tongs;Utensil~Under-counter Drawer;Vanilla~Vegetable Peeler;Waffle~Whisk;Xylophone~X-shaped Cookie Cutter;Yogurt~Yam;Zucchini~Zester"),
    domain("Fruits & Vegetables", ["Fruits & Vegetables", "Garden Foods", "Market Produce", "Healthy Produce", "Colorful Foods"],
           "Apple~Apricot;Banana~Beet;Carrot~Cherry;Date~Daikon;Eggplant~Endive;Fig~Fennel;Grapes~Guava;Honeydew~Horseradish;Iceberg Lettuce~Indian Fig;Jackfruit~Jalapeno;Kiwi~Kale;Lemon~Leek;Mango~Melon;Nectarine~Napa Cabbage;Orange~Okra;Peach~Pumpkin;Quince~Quandong;Radish~Raspberry;Strawberry~Spinach;Tomato~Turnip;Ugli Fruit~Ulluco;Vanilla Bean~Vidalia Onion;Watermelon~Watercress;Xigua~Xoconostle;Yam~Yellow Pepper;Zucchini~Zinfandel Grape"),
    domain("Bakery & Desserts", ["Bakery Treats", "Bread & Pastries", "Cakes & Cookies", "Sweet Shop", "Baking Day"],
           "Apple Pie~Angel Cake;Bread~Brownie;Cupcake~Cookie;Donut~Danish;Eclair~Egg Tart;Frosting~Fruitcake;Gingerbread~Glaze;Honey Bun~Hot Cross Bun;Icing~Ice Cream;Jam Tart~Jelly Donut;Kaiser Roll~Kolache;Loaf~Lemon Tart;Muffin~Macaron;Nut Bread~Napoleon Pastry;Oat Cookie~Orange Cake;Pretzel~Pie;Queen Cake~Quiche;Roll~Raisin Bread;Scone~Sprinkles;Tart~Toast;Upside-down Cake~Ube Roll;Vanilla Cake~Victoria Sponge;Waffle~Wholegrain Bread;Xmas Cookie~X-shaped Pretzel;Yeast Roll~Yule Log;Zebra Cake~Zucchini Bread"),
    domain("School & Classroom", ["Classroom Supplies", "School Learning Tools", "School Day", "Classroom Learning", "Classroom Activities"],
           "Alphabet Chart~Art Paper;Book~Backpack;Crayon~Calculator;Desk~Dictionary;Eraser~Envelope;Folder~Flashcard;Glue~Globe;Highlighter~Hole Punch;Ink~Index Card;Journal~Jigsaw Map;Keyboard~Knowledge Card;Lunchbox~Library Book;Marker~Map;Notebook~Number Chart;Organizer~Origami Paper;Pencil~Paintbrush;Quiz Card~Question Card;Ruler~Reading Book;Scissors~Stapler;Tape~Textbook;Uniform~USB Drive;Vocabulary Card~Violin Case;Whiteboard~Workbook;Xylophone~X-axis Graph;Yarn~Yellow Pencil;Zipper Pouch~Zero Card"),
    domain("Art & Crafts", ["Art Studio", "Colors & Crafts", "Drawing & Painting", "Creative Tools", "Make & Create"],
           "Apron~Art Board;Brush~Bead;Crayon~Canvas;Drawing~Dot Marker;Easel~Eraser;Felt~Frame;Glue~Glitter;Hole Punch~Handprint;Ink~Illustration;Jar~Jewel Sticker;Kraft Paper~Knitting Needle;Loom~Leaf Print;Marker~Modeling Clay;Needle~Notebook;Origami~Oil Pastel;Paint~Pencil;Quilling Paper~Quilt Square;Ribbon~Roller;Scissors~Sponge;Tape~Tempera Paint;Utility Brush~Unfinished Wood;Varnish~Velvet Paper;Watercolor~Wax Crayon;Xylophone Stamp~X-shaped Sticker;Yarn~Yellow Paint;Zigzag Scissors~Zipper Craft"),
    domain("Music & Instruments", ["Musical Instruments", "Rhythm & Melody", "Band & Orchestra", "Music Making", "Sounds & Instruments"],
           "Accordion~Acoustic Guitar;Bell~Bongos;Cello~Clarinet;Drum~Dulcimer;Euphonium~Electric Piano;Flute~Fiddle;Guitar~Gong;Harmonica~Harp;Instrument~Irish Whistle;Jingle Bells~Jaw Harp;Keyboard~Kazoo;Lyre~Lute;Maracas~Mandolin;Note Card~Noise Maker;Oboe~Organ;Piano~Piccolo;Quena~Quarter Note;Recorder~Rhythm Sticks;Saxophone~Shaker;Tambourine~Trumpet;Ukulele~Udu Drum;Violin~Vibraphone;Whistle~Wood Block;Xylophone~Xaphoon;Yidaki~Yangqin;Zither~Zills"),
    domain("Toys & Games", ["Toy Box", "Playroom Fun", "Games & Toys", "Building & Pretend Play", "Playground Toys"],
           "Action Figure~Alphabet Blocks;Ball~Blocks;Crayon~Car Toy;Doll~Dominoes;Etch-a-Sketch~Excavator Toy;Frisbee~Finger Puppet;Game Board~Gyroscope;Hoop~Hobby Horse;Inflatable Ball~Interlocking Blocks;Jump Rope~Jigsaw;Kite~Kaleidoscope;Lego Brick~Letter Tiles;Marble~Model Car;Nesting Blocks~Number Puzzle;Origami~Octopus Toy;Puzzle~Plush Bear;Quoits Ring~Quiz Game;Robot~Rattle;Scooter~Stuffed Animal;Teddy Bear~Toy Train;Unicycle~Uno Cards;Vehicle Toy~Velcro Ball;Wagon~Wooden Blocks;Xylophone Toy~X-shaped Puzzle;Yo-yo~Yarn Doll;Zipper Toy Bag~Zoom Car"),
    domain("Sports & Movement", ["Sports & Games", "Move & Play", "Balls Bikes & Gear", "Active Kids", "Playground Sports"],
           "Archery Target~Athlete;Ball~Bicycle;Cone~Cricket Bat;Dumbbell~Diving Board;Exercise Mat~Equipment Bag;Football~Frisbee;Goal~Goggles;Hoop~Helmet;Inline Skates~Inflatable Pool;Jump Rope~Jersey;Kickboard~Kayak;Lacrosse Stick~Lane Marker;Medal~Mat;Net~Number Bib;Oar~Obstacle;Paddle~Puck;Quoits Ring~Quad Skates;Racket~Relay Baton;Soccer Ball~Skateboard;Tennis Ball~Trampoline;Uniform~Unicycle;Volleyball~Vault;Whistle~Water Bottle;X-shaped Agility Marker~Xylophone;Yoga Mat~Yellow Jersey;Zorb Ball~Zigzag Cone"),
    domain("Vehicles & Roads", ["Things That Go", "Cars Trucks & Machines", "Road Vehicles", "Transport World", "Moving Machines"],
           "Ambulance~ATV;Bus~Bulldozer;Car~Cement Mixer;Dump Truck~Delivery Van;Excavator~Electric Car;Fire Engine~Forklift;Garbage Truck~Golf Cart;Helicopter~Hatchback;Ice Cream Truck~Intercity Bus;Jet~Jeep;Kayak~Kart;Limousine~Loader;Motorcycle~Minivan;Narrowboat~Night Bus;Off-road Car~Oil Tanker;Plane~Pickup;Quad Bike~Quadcopter;Race Car~Road Roller;Scooter~Snowplow;Train~Tractor;Utility Truck~Underground Train;Van~Vespa;Wagon~Wrecker;X-ray Van~Xpress Bus;Yacht~Yard Tractor;Zeppelin~Zero-emission Bus"),
    domain("Trains & Stations", ["Train Station", "Railway World", "Trains & Tracks", "Subway & Rail", "Railway Journey"],
           "Arrival Board~Automatic Gate;Boxcar~Brake;Caboose~Coach;Diesel Engine~Dining Car;Electric Train~Engine;Freight Car~Footbridge;Goods Wagon~Gate;High-speed Train~Hopper Car;Intercity Train~Information Board;Junction~Junction Box;Kiosk~Key Switch;Locomotive~Level Crossing;Metro~Monorail;Night Train~Number Sign;Overpass~Observation Car;Platform~Passenger Car;Quiet Car~Queue Barrier;Rail~Railway Signal;Subway~Sleeper Car;Ticket~Train;Underground Train~Utility Car;Viaduct~Vestibule;Wagon~Waiting Room;Xpress Train~X-crossing Sign;Yard Engine~Yellow Signal;Zigzag Track~Zone Map"),
    domain("Aircraft & Airport", ["Airport & Airplanes", "Flying Machines", "Aircraft & Ground Crew", "Planes & Helicopters", "Flight Day"],
           "Airplane~Airport;Boarding Pass~Biplane;Cockpit~Cargo Plane;Drone~Departure Board;Engine~Elevator Trim;Flight Deck~Fuselage;Glider~Gate;Helicopter~Hangar;Instrument Panel~Inflatable Slide;Jet~Jetway;Kite~Kerosene Tank;Landing Gear~Luggage Cart;Monoplane~Marshaller;Nose Wheel~Navigation Light;Oxygen Mask~Overhead Bin;Propeller~Passenger Plane;Quadcopter~Queue Lane;Runway~Radar;Seatbelt~Seaplane;Tail~Turboprop;Ultralight~Uniform;Vertical Stabilizer~Visor;Wing~Windsock;X-wing Model~X-ray Scanner;Yoke~Yellow Taxiway Sign;Zeppelin~Zero-gravity Plane"),
    domain("Boats & Harbor", ["Boats & Harbor", "Sailing & Sea Travel", "Watercraft World", "Marina & Rescue Boats", "Boat Day"],
           "Anchor~Airboat;Buoy~Barge;Canoe~Catamaran;Dock~Dinghy;Engine~Echo Sounder;Ferry~Fishing Boat;Gangway~Gondola;Harbor~Houseboat;Inflatable Boat~Island Ferry;Jet Ski~Jolly Boat;Kayak~Keel;Lifeboat~Lighthouse;Marina~Motorboat;Navigation Light~Narrowboat;Oar~Ocean Liner;Paddleboat~Pier;Quarterdeck~Quay;Raft~Rescue Boat;Sailboat~Submarine;Tugboat~Trimaran;Underwater Scooter~Utility Boat;Vessel~Voyage Map;Wake~Water Taxi;Xebec~X-ray Sonar Screen;Yacht~Yawl;Zodiac Boat~Zephyr Sail"),
    domain("Construction & Tools", ["Building Site", "Tools & Machines", "Builders at Work", "Construction Gear", "Build & Repair"],
           "Axe~Auger;Bolt~Brick;Crane~Cement Mixer;Drill~Dozer;Excavator~Extension Ladder;Forklift~Framing Hammer;Goggles~Gravel;Hammer~Hard Hat;Impact Driver~I-beam;Jackhammer~Joint;Kneepad~Keyhole Saw;Ladder~Level;Measuring Tape~Mallet;Nail~Nut;Orange Cone~Oil Can;Pliers~Plywood;Quick Clamp~Quoin Brick;Rake~Rivet;Saw~Shovel;Toolbox~Trowel;Utility Knife~Utility Cart;Vise~Voltage Tester;Wrench~Wheelbarrow;Xylophone~X-brace;Yardstick~Yellow Vest;Zip Tie~Zinc Screw"),
    domain("City & Community", ["Around Town", "City Places", "Streets & Buildings", "Neighborhood Life", "Town Explorer"],
           "Ambulance~Apartment;Bakery~Bus Stop;Crosswalk~City Hall;Doctor~Department Store;Elevator~Exit Sign;Fire Station~Fountain;Grocery Store~Garage;Hospital~Hotel;Information Sign~Intersection;Juice Shop~Junction;Kiosk~Kindergarten;Library~Laundromat;Mailbox~Market;Newsstand~Neighborhood;Office~Overpass;Police Car~Park;Quilt Shop~Queue;Restaurant~Road;School~Subway;Taxi~Theater;Underground Train~University;Van~Vet Clinic;Water Fountain~Walkway;X-ray Clinic~X-crossing;Yard~Yoga Studio;Zoo~Zone Sign"),
    domain("Community Helpers", ["Community Helpers", "Jobs Around Town", "People Who Help", "Work & Service", "Helping Hands"],
           "Ambulance~Architect;Baker~Builder;Chef~Courier;Doctor~Dentist;Electrician~EMT;Firefighter~Farmer;Gardener~Garbage Collector;Hairdresser~Helper;Inspector~Interpreter;Janitor~Judge;Kindergarten Teacher~Kitchen Worker;Librarian~Lifeguard;Mail Carrier~Mechanic;Nurse~News Reporter;Optometrist~Officer;Police Officer~Plumber;Quartermaster~Quality Inspector;Rescue Worker~Receptionist;Scientist~Sanitation Worker;Teacher~Taxi Driver;Umpire~Utility Worker;Veterinarian~Volunteer;Waiter~Welder;X-ray Technician~Xylophone Teacher;Yoga Teacher~Yard Worker;Zookeeper~Zumba Instructor"),
    domain("Home & Rooms", ["Around the House", "Home Rooms & Things", "Everyday Home", "Home Helpers & Objects", "Cozy House"],
           "Alarm Clock~Armchair;Bed~Blanket;Chair~Cupboard;Door~Dresser;Envelope~End Table;Fan~Frame;Glass~Garage;Hanger~Hallway;Iron~Indoor Plant;Jar~Jug;Key~Kettle;Lamp~Laundry Basket;Mirror~Mattress;Napkin~Nightlight;Oven~Ottoman;Pillow~Picture;Quilt~Quilted Cushion;Rug~Refrigerator;Soap~Sofa;Towel~Table;Umbrella~Utensil Drawer;Vacuum~Vase;Window~Wardrobe;Xylophone~X-shaped Shelf;Yarn~Yellow Cushion;Zipper~Zen Garden"),
    domain("Clothes & Getting Ready", ["Clothes & Accessories", "Getting Dressed", "Shoes Hats & Coats", "Wardrobe World", "Clothes for Weather"],
           "Apron~Anorak;Boots~Belt;Coat~Cap;Dress~Denim Jacket;Earmuffs~Espadrilles;Flip-flops~Fleece;Gloves~Gown;Hat~Hoodie;Indoor Shoes~Infinity Scarf;Jacket~Jeans;Knee Socks~Knit Cap;Leggings~Lace-up Shoes;Mittens~Moccasins;Nightgown~Necktie;Overcoat~Overall;Pajamas~Poncho;Quilted Jacket~Quarter Socks;Raincoat~Running Shoes;Socks~Scarf;T-shirt~Trainers;Uniform~Ugg Boots;Vest~Velcro Shoes;Wool Hat~Wellies;X-shaped Suspenders~Xmas Sweater;Yellow Jacket~Yoga Pants;Zipper Jacket~Zori Sandals"),
    domain("Body & Senses", ["My Body", "Body & Senses", "Healthy Body", "Doctor & Body", "Move & Feel"],
           "Arm~Ankle;Belly~Back;Cheek~Chin;Dimple~Digestive System;Eye~Elbow;Finger~Foot;Gum~Grip;Hand~Heart;Iris~Incisor;Jaw~Joint;Knee~Knuckle;Leg~Lips;Mouth~Muscle;Nose~Nail;Organ~Outer Ear;Palm~Pupil;Quadriceps~Quick Pulse;Rib~Retina;Shoulder~Skin;Tongue~Toe;Uvula~Upper Arm;Voice~Vision;Wrist~Waist;X-ray~Xiphoid Bone;Yawn~Y-shaped Bone Model;Zygomatic Bone~Zinc Bandage"),
    domain("Feelings & Friendship", ["Feelings & Faces", "Friendship & Kindness", "Calm & Happy", "Sharing & Caring", "Feelings Toolbox"],
           "Angry Face~Affection Heart;Brave Badge~Bashful Bunny;Calm Cloud~Caring Card;Delight Star~Disappointed Face;Excited Eyes~Emotion Cards;Friendship Bracelet~Feelings Wheel;Gratitude Jar~Gentle Hands;Happy Face~Heart;Inside Voice~Interest Card;Joy Jar~Jealous Face;Kindness Card~Kind Hands;Love Letter~Lonely Face;Mood Meter~Mad Face;Nervous Face~Note of Thanks;Optimism Sun~Okay Sign;Proud Star~Patience Timer;Quiet Corner~Question Card;Relaxation Pillow~Respect Badge;Sharing Box~Smile;Thank-you Card~Tired Face;Upset Face~Understanding Heart;Valued Badge~Voice Card;Worry Box~Warm Hug Card;XOXO Card~Xylophone Calm Toy;Yellow Feelings Chart~Yoga Card;Zen Cushion~Zigzag Breath Card"),
    domain("Daily Routine", ["My Daily Routine", "Morning & Evening", "Home Routines", "Getting Ready & Cleaning", "Family Day"],
           "Alarm Clock~Apron;Bed~Bath;Comb~Cup;Dinner~Door;Eggs~Evening Book;Fork~Face Towel;Glass~Getting-dressed Chart;Hairbrush~Hand Soap;Indoor Shoes~Ice Water;Juice~Jacket;Key~Kettle;Lunchbox~Lamp;Milk~Morning Chart;Napkin~Nightlight;Oatmeal~Outfit;Pajamas~Plate;Quilt~Quiet Book;Routine Chart~Robe;Soap~Slippers;Toothbrush~Towel;Uniform~Utensils;Vitamins~Vacuum;Washcloth~Water Bottle;Xylophone~X-shaped Timer;Yogurt~Yawn;Zipper~Zip Pajamas"),
    domain("Fairy Tales & Magic", ["Fairy Tale World", "Castles & Magic", "Dragons Knights & Fairies", "Storybook Kingdom", "Magic Quest"],
           "Apple~Armor;Broom~Bridge;Castle~Crown;Dragon~Dwarf;Enchanted Mirror~Elf;Fairy~Frog Prince;Giant~Goblet;Horse~Harp;Ivy Tower~Ice Palace;Jewel~Jester;Knight~King;Lantern~Lute;Magic Wand~Mermaid;Noble Crown~Nymph;Ogre~Owl;Princess~Potion;Queen~Quest Map;Ring~Royal Robe;Shield~Spell Book;Treasure Chest~Tower;Unicorn~Urn;Velvet Cape~Village;Wizard~Wand;Xylophone~X-marked Treasure Map;Yarn~Yellow Brick;Zodiac Scroll~Zigzag Path"),
    domain("Robots & Science", ["Science & Robots", "Lab & Machines", "Circuits & Gadgets", "Robot Builder", "Future Science"],
           "Atom Model~Android;Beaker~Battery;Circuit~Computer;Drone~Dynamo;Experiment Tube~Electromagnet;Flask~Fuse;Gear~Goggles;Headset~Hydraulic Arm;Indicator Light~Insulator;Jumper Wire~Jet Robot;Keyboard~Kit;Laser~Lab Coat;Microscope~Motor;Nut~Notebook;Oscilloscope~Optical Sensor;Pipette~Processor;QR Code~Quantum Model;Robot~Resistor;Sensor~Switch;Test Tube~Transistor;USB Cable~Ultrasonic Sensor;Voltmeter~Vacuum Tube;Wheel~Wire;X-ray Image~X-axis Plotter;Yellow Wire~Yoke Robot;Zener Diode~Zero-gravity Robot"),
    domain("Seasons & Celebrations", ["Seasons of the Year", "Weather & Seasons", "Seasonal Things", "Year-Round Fun", "Celebrations & Seasons"],
           "Acorn~April Flower;Beach Ball~Blossom;Costume~Cloud;Daisy~Drum;Evergreen~Easter Egg;Firework~Fallen Leaf;Gift~Gloves;Hat~Holly;Ice Skate~Icicle;Jacket~June Sun;Kite~Knitted Scarf;Leaf~Lantern;Mittens~May Flower;Nest~New Year Clock;Ornament~October Pumpkin;Pumpkin~Picnic;Quilt~Quiet Snow;Raincoat~Ribbon;Snowman~Sunflower;Tulip~Toboggan;Umbrella~Under-sun Hat;Valentine Card~Violet;Wreath~Watermelon;Xmas Bell~Xylophone;Yellow Leaf~Yarn Scarf;Zinnia~Zip Coat"),
)


def validate_specs() -> None:
    if len(DOMAINS) != 40:
        raise ValueError(f"Expected 40 macro domains, got {len(DOMAINS)}")
    seen_themes: set[str] = set()
    for spec in DOMAINS:
        if len(spec.themes) != 5 or len(spec.pairs) != 26:
            raise ValueError(f"Invalid domain shape: {spec.macro_domain}")
        for theme in spec.themes:
            key = theme.casefold()
            if key in seen_themes:
                raise ValueError(f"Duplicate theme name: {theme}")
            seen_themes.add(key)
        for letter, pair in zip(LETTERS, spec.pairs):
            left, right = pair
            if left.casefold() == right.casefold():
                raise ValueError(f"{spec.macro_domain} {letter}: candidate pair is identical")
            if not left or left[0].upper() != letter:
                raise ValueError(f"{spec.macro_domain} {letter} -> {left}")
            if not right or right[0].upper() != letter:
                raise ValueError(f"{spec.macro_domain} {letter} -> {right}")


def mapping_for(spec: DomainSpec, variant: int) -> dict[str, str]:
    pattern = PATTERNS[variant]
    return {
        letter: spec.pairs[index][pattern[index]]
        for index, letter in enumerate(LETTERS)
    }


def write_catalog() -> None:
    validate_specs()
    if OUT.exists():
        # Proposals are disposable batch output. Locked production mappings must
        # never live in this generated catalog tree.
        locked_paths = list(OUT.glob("*/mapping.json")) + list(OUT.glob("*/authoring/mapping.json"))
        for mapping in locked_paths:
            raise RuntimeError(f"Refusing to regenerate over locked mapping: {mapping}")
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    rows: list[dict[str, str]] = []
    song_id = 1
    for spec in DOMAINS:
        for variant, theme in enumerate(spec.themes):
            sid = f"{song_id:04d}"
            song_dir = OUT / sid
            song_dir.mkdir(parents=True)
            objects = mapping_for(spec, variant)
            semantic_focus = theme

            (song_dir / "theme.txt").write_text(
                "\n".join([
                    f"Song ID: {sid}",
                    f"Theme: {theme}",
                    f"Semantic Focus: {semantic_focus}",
                    f"Macro Domain: {spec.macro_domain}",
                    "Theme Scope: guided",
                    "Mapping State: PROPOSED",
                    "Language / Locale: English",
                    "Mode: Letter Name",
                    "Audience: Preschool ages 2-6",
                    "",
                ]),
                encoding="utf-8",
            )

            object_lines = [
                f"Song ID: {sid}",
                f"Theme: {theme}",
                f"Macro Domain: {spec.macro_domain}",
                "Mapping State: PROPOSED",
                "",
                "A-Z OBJECTS",
            ]
            object_lines.extend(f"{letter} -> {objects[letter]}" for letter in LETTERS)
            object_lines.append("")
            (song_dir / "objects.txt").write_text("\n".join(object_lines), encoding="utf-8")

            proposal = {
                "version": 2,
                "state": "PROPOSED",
                "songId": sid,
                "theme": {
                    "name": theme,
                    "semanticFocus": semantic_focus,
                    "macroDomain": spec.macro_domain,
                    "scope": "guided",
                    "ageBand": "mixed-2-6",
                    "mode": "LETTER_NAME",
                    "language": "en",
                },
                "letters": {letter: {"object": objects[letter]} for letter in LETTERS},
            }
            (song_dir / "mapping.proposal.json").write_text(
                json.dumps(proposal, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )

            rows.append({
                "song_id": sid,
                "theme": theme,
                "semantic_focus": semantic_focus,
                "macro_domain": spec.macro_domain,
                "theme_scope": "guided",
                "mapping_state": "PROPOSED",
            })
            song_id += 1

    with (OUT / "themes.csv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["song_id", "theme", "semantic_focus", "macro_domain", "theme_scope", "mapping_state"],
        )
        writer.writeheader()
        writer.writerows(rows)

    theme_md = [
        "# ABC Song Theme Catalog - 0001 to 0200",
        "",
        "All mappings are PROPOSED. Diversity gates passed before per-song Mapping QC/lock.",
        "",
        "| Song | Theme / Semantic Focus | Macro Domain | Scope | State |",
        "|---:|---|---|---|---|",
    ]
    theme_md.extend(
        f"| {row['song_id']} | {row['theme']} | {row['macro_domain']} | {row['theme_scope']} | {row['mapping_state']} |"
        for row in rows
    )
    theme_md.append("")
    (OUT / "THEMES.md").write_text("\n".join(theme_md), encoding="utf-8")

    (OUT / "README.md").write_text(
        "# ABC Song Catalog\n\n"
        "200 proposed ABC songs (`0001` through `0200`) generated under the project-local "
        "`abc-song-catalog-designer` diversity contract.\n\n"
        "Each song contains `theme.txt`, `objects.txt`, and `mapping.proposal.json`. "
        "The root also contains `THEMES.md`, `themes.csv`, and machine/human diversity audit reports.\n\n"
        "These are proposals only. Review an individual mapping before promoting it to canonical "
        "`authoring/mapping.json` with `state=LOCKED` and `revision=1`.\n",
        encoding="utf-8",
    )

    report = audit_catalog(OUT)
    write_reports(OUT, report)
    if report["status"] != "READY_FOR_MAPPING_REVIEW":
        raise RuntimeError(f"Generated catalog failed diversity audit: {report['failures']}")

    print(
        f"Created {len(rows)} songs; domains={report['macro_domains']}; "
        f"unique_mappings={report['unique_mappings']}; max_jaccard={report['max_mapping_jaccard']:.3f}; "
        f"status={report['status']}"
    )


if __name__ == "__main__":
    write_catalog()
