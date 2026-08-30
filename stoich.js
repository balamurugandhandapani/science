/* ==============================
   Molecular Weight Engine
   Atomic masses embedded directly (same periodic table data used
   elsewhere on this site) so this file works standalone with no
   external data.js dependency.
============================== */
const ELEMENTS_LITE = [{"symbol": "H", "name": "Hydrogen", "z": 1, "mass": 1.008, "block": "s", "period": 1, "group": 1, "family": "Nonmetals", "oxstates": "+1, -1", "metalclass": "Nonmetal", "color": "Colorless (gas)"}, {"symbol": "He", "name": "Helium", "z": 2, "mass": 4.002602, "block": "s", "period": 1, "group": 18, "family": "Noble gases", "oxstates": "None typical", "metalclass": "Nonmetal", "color": "Colorless (gas)"}, {"symbol": "Li", "name": "Lithium", "z": 3, "mass": 6.94, "block": "s", "period": 2, "group": 1, "family": "Alkali metals", "oxstates": "+1", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Be", "name": "Beryllium", "z": 4, "mass": 9.0121831, "block": "s", "period": 2, "group": 2, "family": "Alkaline earth metals", "oxstates": "+2", "metalclass": "Metal", "color": "Steel-gray/white"}, {"symbol": "B", "name": "Boron", "z": 5, "mass": 10.81, "block": "p", "period": 2, "group": 13, "family": "Metalloids", "oxstates": "+3", "metalclass": "Metalloid", "color": "Black (crystalline) / brown (amorphous)"}, {"symbol": "C", "name": "Carbon", "z": 6, "mass": 12.011, "block": "p", "period": 2, "group": 14, "family": "Nonmetals", "oxstates": "+4, -4", "metalclass": "Nonmetal", "color": "Black (graphite) / colorless (diamond)"}, {"symbol": "N", "name": "Nitrogen", "z": 7, "mass": 14.007, "block": "p", "period": 2, "group": 15, "family": "Nonmetals", "oxstates": "+5, +3, -3", "metalclass": "Nonmetal", "color": "Colorless (gas)"}, {"symbol": "O", "name": "Oxygen", "z": 8, "mass": 15.999, "block": "p", "period": 2, "group": 16, "family": "Nonmetals", "oxstates": "-2", "metalclass": "Nonmetal", "color": "Colorless (gas), pale blue (liquid)"}, {"symbol": "F", "name": "Fluorine", "z": 9, "mass": 18.998403163, "block": "p", "period": 2, "group": 17, "family": "Halogens", "oxstates": "-1", "metalclass": "Nonmetal", "color": "Pale yellow (gas)"}, {"symbol": "Ne", "name": "Neon", "z": 10, "mass": 20.1797, "block": "p", "period": 2, "group": 18, "family": "Noble gases", "oxstates": "None typical", "metalclass": "Nonmetal", "color": "Colorless (gas)"}, {"symbol": "Na", "name": "Sodium", "z": 11, "mass": 22.98976928, "block": "s", "period": 3, "group": 1, "family": "Alkali metals", "oxstates": "+1", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Mg", "name": "Magnesium", "z": 12, "mass": 24.305, "block": "s", "period": 3, "group": 2, "family": "Alkaline earth metals", "oxstates": "+2", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Al", "name": "Aluminum", "z": 13, "mass": 26.9815385, "block": "p", "period": 3, "group": 13, "family": "Post-transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Si", "name": "Silicon", "z": 14, "mass": 28.085, "block": "p", "period": 3, "group": 14, "family": "Metalloids", "oxstates": "+4, -4", "metalclass": "Metalloid", "color": "Dark gray with blue tinge (metallic luster)"}, {"symbol": "P", "name": "Phosphorus", "z": 15, "mass": 30.973761998, "block": "p", "period": 3, "group": 15, "family": "Nonmetals", "oxstates": "+5, +3, -3", "metalclass": "Nonmetal", "color": "White/waxy (white P), red (red P), black (black P)"}, {"symbol": "S", "name": "Sulfur", "z": 16, "mass": 32.06, "block": "p", "period": 3, "group": 16, "family": "Nonmetals", "oxstates": "+6, +4, +2, -2", "metalclass": "Nonmetal", "color": "Bright yellow"}, {"symbol": "Cl", "name": "Chlorine", "z": 17, "mass": 35.45, "block": "p", "period": 3, "group": 17, "family": "Halogens", "oxstates": "+7, +5, +3, +1, -1", "metalclass": "Nonmetal", "color": "Pale yellow-green (gas)"}, {"symbol": "Ar", "name": "Argon", "z": 18, "mass": 39.948, "block": "p", "period": 3, "group": 18, "family": "Noble gases", "oxstates": "None typical", "metalclass": "Nonmetal", "color": "Colorless (gas)"}, {"symbol": "K", "name": "Potassium", "z": 19, "mass": 39.0983, "block": "s", "period": 4, "group": 1, "family": "Alkali metals", "oxstates": "+1", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Ca", "name": "Calcium", "z": 20, "mass": 40.078, "block": "s", "period": 4, "group": 2, "family": "Alkaline earth metals", "oxstates": "+2", "metalclass": "Metal", "color": "Dull gray/silvery-white"}, {"symbol": "Sc", "name": "Scandium", "z": 21, "mass": 44.955908, "block": "d", "period": 4, "group": 3, "family": "Transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Ti", "name": "Titanium", "z": 22, "mass": 47.867, "block": "d", "period": 4, "group": 4, "family": "Transition metals", "oxstates": "+4", "metalclass": "Metal", "color": "Silvery gray-white"}, {"symbol": "V", "name": "Vanadium", "z": 23, "mass": 50.9415, "block": "d", "period": 4, "group": 5, "family": "Transition metals", "oxstates": "+5", "metalclass": "Metal", "color": "Blue-silver-gray"}, {"symbol": "Cr", "name": "Chromium", "z": 24, "mass": 51.9961, "block": "d", "period": 4, "group": 6, "family": "Transition metals", "oxstates": "+6, +3", "metalclass": "Metal", "color": "Silvery, steel-gray, lustrous"}, {"symbol": "Mn", "name": "Manganese", "z": 25, "mass": 54.938044, "block": "d", "period": 4, "group": 7, "family": "Transition metals", "oxstates": "+7, +4, +2", "metalclass": "Metal", "color": "Silvery, metallic gray"}, {"symbol": "Fe", "name": "Iron", "z": 26, "mass": 55.845, "block": "d", "period": 4, "group": 8, "family": "Transition metals", "oxstates": "+3, +2", "metalclass": "Metal", "color": "Silvery-gray/lustrous metallic"}, {"symbol": "Co", "name": "Cobalt", "z": 27, "mass": 58.933194, "block": "d", "period": 4, "group": 9, "family": "Transition metals", "oxstates": "+3, +2", "metalclass": "Metal", "color": "Silvery-blue/steel-gray"}, {"symbol": "Ni", "name": "Nickel", "z": 28, "mass": 58.6934, "block": "d", "period": 4, "group": 10, "family": "Transition metals", "oxstates": "+2", "metalclass": "Metal", "color": "Silvery-white with a gold tinge"}, {"symbol": "Cu", "name": "Copper", "z": 29, "mass": 63.546, "block": "d", "period": 4, "group": 11, "family": "Transition metals", "oxstates": "+2", "metalclass": "Metal", "color": "Reddish-orange/copper-colored"}, {"symbol": "Zn", "name": "Zinc", "z": 30, "mass": 65.38, "block": "d", "period": 4, "group": 12, "family": "Transition metals", "oxstates": "+2", "metalclass": "Metal", "color": "Bluish-silvery-gray"}, {"symbol": "Ga", "name": "Gallium", "z": 31, "mass": 69.723, "block": "p", "period": 4, "group": 13, "family": "Post-transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Ge", "name": "Germanium", "z": 32, "mass": 72.63, "block": "p", "period": 4, "group": 14, "family": "Metalloids", "oxstates": "+4, +2, -4", "metalclass": "Metalloid", "color": "Grayish-white (metallic luster)"}, {"symbol": "As", "name": "Arsenic", "z": 33, "mass": 74.921595, "block": "p", "period": 4, "group": 15, "family": "Metalloids", "oxstates": "+5, +3, -3", "metalclass": "Metalloid", "color": "Metallic gray (most common form)"}, {"symbol": "Se", "name": "Selenium", "z": 34, "mass": 78.971, "block": "p", "period": 4, "group": 16, "family": "Nonmetals", "oxstates": "+6, +4, +2, -2", "metalclass": "Nonmetal", "color": "Gray (metallic), red (amorphous)"}, {"symbol": "Br", "name": "Bromine", "z": 35, "mass": 79.904, "block": "p", "period": 4, "group": 17, "family": "Halogens", "oxstates": "+5, +3, +1, -1", "metalclass": "Nonmetal", "color": "Reddish-brown (liquid)"}, {"symbol": "Kr", "name": "Krypton", "z": 36, "mass": 83.798, "block": "p", "period": 4, "group": 18, "family": "Noble gases", "oxstates": "+2", "metalclass": "Nonmetal", "color": "Colorless (gas)"}, {"symbol": "Rb", "name": "Rubidium", "z": 37, "mass": 85.4678, "block": "s", "period": 5, "group": 1, "family": "Alkali metals", "oxstates": "+1", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Sr", "name": "Strontium", "z": 38, "mass": 87.62, "block": "s", "period": 5, "group": 2, "family": "Alkaline earth metals", "oxstates": "+2", "metalclass": "Metal", "color": "Silvery-white/pale yellow tarnish"}, {"symbol": "Y", "name": "Yttrium", "z": 39, "mass": 88.90584, "block": "d", "period": 5, "group": 3, "family": "Transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Zr", "name": "Zirconium", "z": 40, "mass": 91.224, "block": "d", "period": 5, "group": 4, "family": "Transition metals", "oxstates": "+4", "metalclass": "Metal", "color": "Silvery-white/gray"}, {"symbol": "Nb", "name": "Niobium", "z": 41, "mass": 92.90637, "block": "d", "period": 5, "group": 5, "family": "Transition metals", "oxstates": "+5", "metalclass": "Metal", "color": "Gray, metallic, bluish tinge"}, {"symbol": "Mo", "name": "Molybdenum", "z": 42, "mass": 95.95, "block": "d", "period": 5, "group": 6, "family": "Transition metals", "oxstates": "+6, +4", "metalclass": "Metal", "color": "Silvery-gray metallic"}, {"symbol": "Tc", "name": "Technetium", "z": 43, "mass": 97.90721, "block": "d", "period": 5, "group": 7, "family": "Transition metals", "oxstates": "+7, +4", "metalclass": "Metal", "color": "Silvery-gray metallic"}, {"symbol": "Ru", "name": "Ruthenium", "z": 44, "mass": 101.07, "block": "d", "period": 5, "group": 8, "family": "Transition metals", "oxstates": "+4, +3", "metalclass": "Metal", "color": "Silvery-white metallic"}, {"symbol": "Rh", "name": "Rhodium", "z": 45, "mass": 102.9055, "block": "d", "period": 5, "group": 9, "family": "Transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white metallic"}, {"symbol": "Pd", "name": "Palladium", "z": 46, "mass": 106.42, "block": "d", "period": 5, "group": 10, "family": "Transition metals", "oxstates": "+4, +2", "metalclass": "Metal", "color": "Silvery-white metallic"}, {"symbol": "Ag", "name": "Silver", "z": 47, "mass": 107.8682, "block": "d", "period": 5, "group": 11, "family": "Transition metals", "oxstates": "+1", "metalclass": "Metal", "color": "Silvery-white (most reflective metal)"}, {"symbol": "Cd", "name": "Cadmium", "z": 48, "mass": 112.414, "block": "d", "period": 5, "group": 12, "family": "Transition metals", "oxstates": "+2", "metalclass": "Metal", "color": "Silvery-bluish-white"}, {"symbol": "In", "name": "Indium", "z": 49, "mass": 114.818, "block": "p", "period": 5, "group": 13, "family": "Post-transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Sn", "name": "Tin", "z": 50, "mass": 118.71, "block": "p", "period": 5, "group": 14, "family": "Post-transition metals", "oxstates": "+4, +2, -4", "metalclass": "Metal", "color": "Silvery-white (beta/white tin), gray (alpha/gray tin)"}, {"symbol": "Sb", "name": "Antimony", "z": 51, "mass": 121.76, "block": "p", "period": 5, "group": 15, "family": "Metalloids", "oxstates": "+5, +3, -3", "metalclass": "Metalloid", "color": "Silvery-white, lustrous (metallic form)"}, {"symbol": "Te", "name": "Tellurium", "z": 52, "mass": 127.6, "block": "p", "period": 5, "group": 16, "family": "Metalloids", "oxstates": "+6, +4, +2, -2", "metalclass": "Metalloid", "color": "Silvery-white, metallic luster"}, {"symbol": "I", "name": "Iodine", "z": 53, "mass": 126.90447, "block": "p", "period": 5, "group": 17, "family": "Halogens", "oxstates": "+7, +5, +3, +1, -1", "metalclass": "Nonmetal", "color": "Dark violet-black solid (violet vapor)"}, {"symbol": "Xe", "name": "Xenon", "z": 54, "mass": 131.293, "block": "p", "period": 5, "group": 18, "family": "Noble gases", "oxstates": "+6, +4, +2", "metalclass": "Nonmetal", "color": "Colorless (gas)"}, {"symbol": "Cs", "name": "Cesium", "z": 55, "mass": 132.90545196, "block": "s", "period": 6, "group": 1, "family": "Alkali metals", "oxstates": "+1", "metalclass": "Metal", "color": "Silvery-gold"}, {"symbol": "Ba", "name": "Barium", "z": 56, "mass": 137.327, "block": "s", "period": 6, "group": 2, "family": "Alkaline earth metals", "oxstates": "+2", "metalclass": "Metal", "color": "Silvery-white/pale yellow"}, {"symbol": "La", "name": "Lanthanum", "z": 57, "mass": 138.90547, "block": "d", "period": 6, "group": 3, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Ce", "name": "Cerium", "z": 58, "mass": 140.116, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+4, +3", "metalclass": "Metal", "color": "Silvery-white/iron-gray"}, {"symbol": "Pr", "name": "Praseodymium", "z": 59, "mass": 140.90766, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white/yellowish"}, {"symbol": "Nd", "name": "Neodymium", "z": 60, "mass": 144.242, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Pm", "name": "Promethium", "z": 61, "mass": 144.91276, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white (metallic, presumed)"}, {"symbol": "Sm", "name": "Samarium", "z": 62, "mass": 150.36, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Eu", "name": "Europium", "z": 63, "mass": 151.964, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3, +2", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Gd", "name": "Gadolinium", "z": 64, "mass": 157.25, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Tb", "name": "Terbium", "z": 65, "mass": 158.92535, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Dy", "name": "Dysprosium", "z": 66, "mass": 162.5, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Ho", "name": "Holmium", "z": 67, "mass": 164.93033, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Er", "name": "Erbium", "z": 68, "mass": 167.259, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Tm", "name": "Thulium", "z": 69, "mass": 168.93422, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Yb", "name": "Ytterbium", "z": 70, "mass": 173.045, "block": "f", "period": 6, "group": null, "family": "Lanthanides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Lu", "name": "Lutetium", "z": 71, "mass": 174.9668, "block": "f", "period": 6, "group": null, "family": "Transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Hf", "name": "Hafnium", "z": 72, "mass": 178.49, "block": "d", "period": 6, "group": 4, "family": "Transition metals", "oxstates": "+4", "metalclass": "Metal", "color": "Steel-gray"}, {"symbol": "Ta", "name": "Tantalum", "z": 73, "mass": 180.94788, "block": "d", "period": 6, "group": 5, "family": "Transition metals", "oxstates": "+5", "metalclass": "Metal", "color": "Blue-gray/black, lustrous"}, {"symbol": "W", "name": "Tungsten", "z": 74, "mass": 183.84, "block": "d", "period": 6, "group": 6, "family": "Transition metals", "oxstates": "+6, +4", "metalclass": "Metal", "color": "Steel-gray to tin-white"}, {"symbol": "Re", "name": "Rhenium", "z": 75, "mass": 186.207, "block": "d", "period": 6, "group": 7, "family": "Transition metals", "oxstates": "+4", "metalclass": "Metal", "color": "Silvery-white/gray metallic"}, {"symbol": "Os", "name": "Osmium", "z": 76, "mass": 190.23, "block": "d", "period": 6, "group": 8, "family": "Transition metals", "oxstates": "+4", "metalclass": "Metal", "color": "Blue-gray/silvery metallic"}, {"symbol": "Ir", "name": "Iridium", "z": 77, "mass": 192.217, "block": "d", "period": 6, "group": 9, "family": "Transition metals", "oxstates": "+4, +3", "metalclass": "Metal", "color": "Silvery-white metallic"}, {"symbol": "Pt", "name": "Platinum", "z": 78, "mass": 195.084, "block": "d", "period": 6, "group": 10, "family": "Transition metals", "oxstates": "+4, +2", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Au", "name": "Gold", "z": 79, "mass": 196.966569, "block": "d", "period": 6, "group": 11, "family": "Transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Metallic yellow (gold)"}, {"symbol": "Hg", "name": "Mercury", "z": 80, "mass": 200.592, "block": "d", "period": 6, "group": 12, "family": "Transition metals", "oxstates": "+2, +1", "metalclass": "Metal", "color": "Silvery-white (liquid)"}, {"symbol": "Tl", "name": "Thallium", "z": 81, "mass": 204.38, "block": "p", "period": 6, "group": 13, "family": "Post-transition metals", "oxstates": "+3, +1", "metalclass": "Metal", "color": "Silvery-white (tarnishes bluish-gray)"}, {"symbol": "Pb", "name": "Lead", "z": 82, "mass": 207.2, "block": "p", "period": 6, "group": 14, "family": "Post-transition metals", "oxstates": "+4, +2", "metalclass": "Metal", "color": "Bluish-white to gray (metallic, dulls in air)"}, {"symbol": "Bi", "name": "Bismuth", "z": 83, "mass": 208.9804, "block": "p", "period": 6, "group": 15, "family": "Post-transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white with pinkish tinge, often iridescent oxide tarnish"}, {"symbol": "Po", "name": "Polonium", "z": 84, "mass": 209.0, "block": "p", "period": 6, "group": 16, "family": "Metalloids", "oxstates": "+4, +2, -2", "metalclass": "Metalloid", "color": "Silvery-gray"}, {"symbol": "At", "name": "Astatine", "z": 85, "mass": 210.0, "block": "p", "period": 6, "group": 17, "family": "Halogens", "oxstates": "+1, -1", "metalclass": "Nonmetal", "color": "Unknown - never observed in bulk (extremely rare, presumed dark/metallic)"}, {"symbol": "Rn", "name": "Radon", "z": 86, "mass": 222.0, "block": "p", "period": 6, "group": 18, "family": "Noble gases", "oxstates": "None typical", "metalclass": "Nonmetal", "color": "Colorless (gas), glows reddish in discharge tube"}, {"symbol": "Fr", "name": "Francium", "z": 87, "mass": 223.0, "block": "s", "period": 7, "group": 1, "family": "Alkali metals", "oxstates": "+1", "metalclass": "Metal", "color": "Unknown - never observed in bulk (extremely rare, presumed silvery metallic)"}, {"symbol": "Ra", "name": "Radium", "z": 88, "mass": 226.0, "block": "s", "period": 7, "group": 2, "family": "Alkaline earth metals", "oxstates": "+2", "metalclass": "Metal", "color": "Silvery-white (tarnishes black in air)"}, {"symbol": "Ac", "name": "Actinium", "z": 89, "mass": 227.0, "block": "d", "period": 7, "group": 3, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white (glows blue in the dark)"}, {"symbol": "Th", "name": "Thorium", "z": 90, "mass": 232.0377, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+4", "metalclass": "Metal", "color": "Silvery-white (tarnishes gray/black)"}, {"symbol": "Pa", "name": "Protactinium", "z": 91, "mass": 231.03588, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+5", "metalclass": "Metal", "color": "Silvery-metallic, bright"}, {"symbol": "U", "name": "Uranium", "z": 92, "mass": 238.02891, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+6", "metalclass": "Metal", "color": "Silvery-white (tarnishes gray/black)"}, {"symbol": "Np", "name": "Neptunium", "z": 93, "mass": 237.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+5", "metalclass": "Metal", "color": "Silvery metallic (tarnishes)"}, {"symbol": "Pu", "name": "Plutonium", "z": 94, "mass": 244.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+4", "metalclass": "Metal", "color": "Silvery-white (tarnishes yellow then olive-green/black)"}, {"symbol": "Am", "name": "Americium", "z": 95, "mass": 243.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Cm", "name": "Curium", "z": 96, "mass": 247.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white"}, {"symbol": "Bk", "name": "Berkelium", "z": 97, "mass": 247.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white (presumed)"}, {"symbol": "Cf", "name": "Californium", "z": 98, "mass": 251.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Silvery-white (presumed)"}, {"symbol": "Es", "name": "Einsteinium", "z": 99, "mass": 252.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Unknown - trace quantities only"}, {"symbol": "Fm", "name": "Fermium", "z": 100, "mass": 257.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Unknown - never observed in bulk"}, {"symbol": "Md", "name": "Mendelevium", "z": 101, "mass": 258.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Unknown - never observed in bulk"}, {"symbol": "No", "name": "Nobelium", "z": 102, "mass": 259.0, "block": "f", "period": 7, "group": null, "family": "Actinides", "oxstates": "+3", "metalclass": "Metal", "color": "Unknown - never observed in bulk"}, {"symbol": "Lr", "name": "Lawrencium", "z": 103, "mass": 262.0, "block": "f", "period": 7, "group": null, "family": "Transition metals", "oxstates": "+3", "metalclass": "Metal", "color": "Unknown - never observed in bulk"}, {"symbol": "Rf", "name": "Rutherfordium", "z": 104, "mass": 267.0, "block": "d", "period": 7, "group": 4, "family": "Transition metals", "oxstates": "+4", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Db", "name": "Dubnium", "z": 105, "mass": 268.0, "block": "d", "period": 7, "group": 5, "family": "Transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Sg", "name": "Seaborgium", "z": 106, "mass": 271.0, "block": "d", "period": 7, "group": 6, "family": "Transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Bh", "name": "Bohrium", "z": 107, "mass": 274.0, "block": "d", "period": 7, "group": 7, "family": "Transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Hs", "name": "Hassium", "z": 108, "mass": 269.0, "block": "d", "period": 7, "group": 8, "family": "Transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Mt", "name": "Meitnerium", "z": 109, "mass": 276.0, "block": "d", "period": 7, "group": 9, "family": "Transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Ds", "name": "Darmstadtium", "z": 110, "mass": 281.0, "block": "d", "period": 7, "group": 10, "family": "Transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Rg", "name": "Roentgenium", "z": 111, "mass": 281.0, "block": "d", "period": 7, "group": 11, "family": "Transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Cn", "name": "Copernicium", "z": 112, "mass": 285.0, "block": "d", "period": 7, "group": 12, "family": "Transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Nh", "name": "Nihonium", "z": 113, "mass": 286.0, "block": "p", "period": 7, "group": 13, "family": "Post-transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Fl", "name": "Flerovium", "z": 114, "mass": 289.0, "block": "p", "period": 7, "group": 14, "family": "Post-transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Mc", "name": "Moscovium", "z": 115, "mass": 288.0, "block": "p", "period": 7, "group": 15, "family": "Post-transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Lv", "name": "Livermorium", "z": 116, "mass": 293.0, "block": "p", "period": 7, "group": 16, "family": "Post-transition metals", "oxstates": "None typical", "metalclass": "Metal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Ts", "name": "Tennessine", "z": 117, "mass": 294.0, "block": "p", "period": 7, "group": 17, "family": "Halogens", "oxstates": "None typical", "metalclass": "Nonmetal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}, {"symbol": "Og", "name": "Oganesson", "z": 118, "mass": 294.0, "block": "p", "period": 7, "group": 18, "family": "Noble gases", "oxstates": "None typical", "metalclass": "Nonmetal", "color": "Unknown - never produced in visible/macroscopic quantities (only single atoms made, extremely short-lived)"}];
const ATOMIC_MASS = {};
ELEMENTS_LITE.forEach(e => ATOMIC_MASS[e.symbol] = e.mass);

function parseFormula(formula){
  const hydrateParts = formula.split(/\.(?=\d*[A-Z])/);
  const total = {};
  hydrateParts.forEach((part, i) => {
    let mult = 1;
    if (i > 0) {
      const m = part.match(/^(\d+)/);
      if (m) { mult = parseInt(m[1], 10); part = part.slice(m[1].length); }
    }
    const comp = parseSimpleFormula(part);
    for (const el in comp) total[el] = (total[el] || 0) + comp[el] * mult;
  });
  return total;
}

function parseSimpleFormula(formula){
  const tokens = formula.match(/[A-Z][a-z]?|\d+|\(|\)/g) || [];
  const stack = [{}];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === '(') {
      stack.push({});
      i++;
    } else if (tok === ')') {
      i++;
      let mult = 1;
      if (i < tokens.length && /^\d+$/.test(tokens[i])) { mult = parseInt(tokens[i], 10); i++; }
      const group = stack.pop();
      for (const el in group) stack[stack.length-1][el] = (stack[stack.length-1][el] || 0) + group[el] * mult;
    } else if (/^[A-Z][a-z]?$/.test(tok)) {
      const el = tok; i++;
      let count = 1;
      if (i < tokens.length && /^\d+$/.test(tokens[i])) { count = parseInt(tokens[i], 10); i++; }
      stack[stack.length-1][el] = (stack[stack.length-1][el] || 0) + count;
    } else {
      i++;
    }
  }
  return stack[0];
}

function computeMW(formula){
  const comp = parseFormula(formula);
  let mw = 0;
  const missing = [];
  for (const el in comp) {
    if (el in ATOMIC_MASS) mw += ATOMIC_MASS[el] * comp[el];
    else missing.push(el);
  }
  return { mw, comp, missing };
}

const CA_MW  = computeMW('C6H8O7').mw;
const EG_MW  = computeMW('C2H6O2').mw;
const NH3_MW = computeMW('NH3').mw;
const EG_DENSITY = 1.11, NH3_DENSITY = 0.91, NH3_STRENGTH = 0.25;

function escapeHtmlMW(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function elementOptionsHtml(selected=""){
  return ELEMENTS_LITE.map(e =>
    `<option value="${e.symbol}" ${e.symbol===selected?'selected':''}>${e.symbol} - ${e.name}</option>`
  ).join('');
}

function gridPos(el){
  if (el.z >= 57 && el.z <= 71) return {row: 9, col: 3 + (el.z-57)};
  if (el.z >= 89 && el.z <= 103) return {row: 10, col: 3 + (el.z-89)};
  if (typeof el.group === "number") return {row: el.period, col: el.group};
  return null;
}
function blockClass(b){ return "mini-block-" + (b || "s"); }

let activePickerTargetInput = null;

function buildMiniPtable(){
  const grid = document.getElementById('miniPtableGrid');
  if (grid.dataset.built) return;
  grid.style.gridTemplateRows = "repeat(7, 1fr) 10px repeat(2, 1fr)";
  const placeholders = [{row:6,col:3,label:"57-71"},{row:7,col:3,label:"89-103"}];
  placeholders.forEach(p=>{
    const d = document.createElement("div");
    d.className = "mini-cell mini-placeholder";
    d.style.gridRow = p.row; d.style.gridColumn = p.col;
    d.textContent = p.label;
    grid.appendChild(d);
  });
  for (let c=1;c<=18;c++){
    const s = document.createElement("div");
    s.className = "mini-cell mini-spacer";
    s.style.gridRow = 8; s.style.gridColumn = c;
    grid.appendChild(s);
  }
  ELEMENTS_LITE.forEach(el=>{
    const pos = gridPos(el);
    if(!pos) return;
    const d = document.createElement("div");
    d.className = "mini-cell " + blockClass(el.block);
    d.style.gridRow = pos.row; d.style.gridColumn = pos.col;
    d.title = `${el.symbol} - ${el.name}`;
    d.textContent = el.symbol;
    d.addEventListener("click", ()=> choosePickerElement(el.symbol));
    grid.appendChild(d);
  });
  grid.dataset.built = "1";
}

function openElementPicker(targetInputId){
  activePickerTargetInput = targetInputId;
  buildMiniPtable();
  document.getElementById('miniPtableOverlay').classList.add('show');
}
function closeElementPicker(){
  document.getElementById('miniPtableOverlay').classList.remove('show');
  activePickerTargetInput = null;
}
function choosePickerElement(symbol){
  if (!activePickerTargetInput) return;
  const input = document.getElementById(activePickerTargetInput);
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + symbol + input.value.slice(end);
  input.focus();
  closeElementPicker();
}

function escapeHtml(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ==============================
   Tab Switching
============================== */
document.querySelectorAll('.calc-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.calc-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

/* ==============================
   Tolerance Factor Calculator
   t = (rA + rO) / [sqrt(2) x (rB_avg + rO)]
============================== */
function calcTolerance(){
  const compound = document.getElementById('tf-compound').value || 'Compound';
  const rA = parseFloat(document.getElementById('tf-ra').value);
  const rB = parseFloat(document.getElementById('tf-rb').value);
  const rBpRaw = document.getElementById('tf-rbp').value;
  const rBp = rBpRaw === '' ? null : parseFloat(rBpRaw);
  const rO = parseFloat(document.getElementById('tf-ro').value);

  if (isNaN(rA) || isNaN(rB) || isNaN(rO)) {
    document.getElementById('tf-result').innerHTML = '<div class="calc-error">Please fill in rA, rB, and rO.</div>';
    return;
  }
  const rBavg = (rBp === null || isNaN(rBp)) ? rB : (rB + rBp) / 2;
  const numerator = rA + rO;
  const denominator = Math.sqrt(2) * (rBavg + rO);
  const t = numerator / denominator;

  let stability;
  if (t > 1.0) stability = 'Hexagonal / non-cubic (t &gt; 1.0)';
  else if (t >= 0.9) stability = 'Ideal cubic perovskite (0.9 &ndash; 1.0)';
  else if (t >= 0.71) stability = 'Orthorhombic / rhombohedral, tilted octahedra (0.71 &ndash; 0.9)';
  else stability = 'Not perovskite-forming (t &lt; 0.71)';

  document.getElementById('tf-result').innerHTML = `
    <table class="result-table">
      <tr><td>Compound</td><td>${escapeHtml(compound)}</td></tr>
      <tr><td>r<sub>B avg</sub></td><td>${rBavg.toFixed(4)} &Aring;</td></tr>
      <tr><td>r<sub>A</sub> + r<sub>O</sub></td><td>${numerator.toFixed(4)} &Aring;</td></tr>
      <tr><td>&radic;2 &times; (r<sub>B avg</sub> + r<sub>O</sub>)</td><td>${denominator.toFixed(4)} &Aring;</td></tr>
      <tr class="result-highlight"><td>Tolerance factor, t</td><td>${t.toFixed(4)}</td></tr>
      <tr><td>Predicted structure</td><td>${stability}</td></tr>
    </table>`;
}

/* ==============================
   Chemical Equation Balancer
   Solves for integer coefficients via Gaussian elimination on the
   elemental composition of each species (exact fraction arithmetic,
   not floating point) - works for any valid equation, not a lookup.
============================== */
function fgcd(a,b){ a=Math.abs(a); b=Math.abs(b); while(b){[a,b]=[b,a%b];} return a||1; }
class Frac {
  constructor(n, d=1){
    if (d < 0) { n=-n; d=-d; }
    const g = fgcd(n,d) || 1;
    this.n = n/g; this.d = d/g;
  }
  add(o){ return new Frac(this.n*o.d + o.n*this.d, this.d*o.d); }
  sub(o){ return new Frac(this.n*o.d - o.n*this.d, this.d*o.d); }
  mul(o){ return new Frac(this.n*o.n, this.d*o.d); }
  div(o){ return new Frac(this.n*o.d, this.d*o.n); }
  isZero(){ return this.n === 0; }
}
const Fr = (n,d=1) => new Frac(n,d);

function balanceEquation(reactants, products){
  const species = reactants.concat(products);
  const comps = species.map(s => parseSimpleFormula(s));
  const elementsSet = new Set();
  comps.forEach(c => Object.keys(c).forEach(el => elementsSet.add(el)));
  const elements = Array.from(elementsSet).sort();
  const n = species.length;
  let M = elements.map(el => comps.map((c,i) => {
    const val = c[el] || 0;
    return Fr(i >= reactants.length ? -val : val);
  }));
  const m = M.length;
  let pivotCols = [];
  let r = 0;
  for (let c = 0; c < n && r < m; c++){
    let pivotRow = -1;
    for (let rr = r; rr < m; rr++){ if (!M[rr][c].isZero()){ pivotRow = rr; break; } }
    if (pivotRow === -1) continue;
    [M[r], M[pivotRow]] = [M[pivotRow], M[r]];
    const piv = M[r][c];
    M[r] = M[r].map(x => x.div(piv));
    for (let rr = 0; rr < m; rr++){
      if (rr !== r && !M[rr][c].isZero()){
        const factor = M[rr][c];
        M[rr] = M[rr].map((x,k) => x.sub(factor.mul(M[r][k])));
      }
    }
    pivotCols.push(c);
    r++;
  }
  const freeCols = [];
  for (let c = 0; c < n; c++) if (!pivotCols.includes(c)) freeCols.push(c);
  if (freeCols.length === 0) return null;
  const freeCol = freeCols[0];
  let x = new Array(n).fill(Fr(0));
  x[freeCol] = Fr(1);
  for (let i = 0; i < pivotCols.length; i++) x[pivotCols[i]] = M[i][freeCol].mul(Fr(-1));
  let lcm = 1;
  x.forEach(xi => { lcm = lcm * xi.d / fgcd(lcm, xi.d); });
  let ints = x.map(xi => Math.round(xi.n * lcm / xi.d));
  let g = 0;
  ints.forEach(v => g = fgcd(g, v));
  if (g > 0) ints = ints.map(v => v/g);
  if (ints.some(v => v < 0)) ints = ints.map(v => -v);
  if (ints.some(v => v === 0)) return null;
  return ints;
}

let currentEquation = null; // {reactants:[...], products:[...], coeffs:[...]}

function formatFormulaHtml(f){
  return escapeHtml(f).replace(/(\d+)/g, '<sub>$1</sub>');
}

function doBalance(){
  const reactants = document.getElementById('eqReactants').value.split('+').map(s=>s.trim()).filter(Boolean);
  const products = document.getElementById('eqProducts').value.split('+').map(s=>s.trim()).filter(Boolean);
  const resultBox = document.getElementById('balancedEqResult');
  if (reactants.length === 0 || products.length === 0) {
    resultBox.innerHTML = '<div class="calc-error">Enter at least one reactant and one product.</div>';
    document.getElementById('stoichSection').style.display = 'none';
    return;
  }
  let coeffs;
  try {
    coeffs = balanceEquation(reactants, products);
  } catch(e) {
    coeffs = null;
  }
  if (!coeffs) {
    resultBox.innerHTML = '<div class="calc-error">Could not balance this equation - check the formulas are valid and the reaction is chemically possible (elements must match on both sides).</div>';
    document.getElementById('stoichSection').style.display = 'none';
    return;
  }
  currentEquation = { reactants, products, coeffs };
  const rSide = reactants.map((s,i) => (coeffs[i]!==1 ? coeffs[i] : '') + formatFormulaHtml(s)).join(' + ');
  const pSide = products.map((s,i) => (coeffs[reactants.length+i]!==1 ? coeffs[reactants.length+i] : '') + formatFormulaHtml(s)).join(' + ');
  resultBox.innerHTML = `<table class="result-table"><tr class="result-highlight"><td>Balanced equation</td><td style="font-size:15px;">${rSide} &rarr; ${pSide}</td></tr></table>`;
  buildStoichTable();
  buildLimitingTable();
  document.getElementById('stoichSection').style.display = 'block';
}

function buildStoichTable(){
  const { reactants, products, coeffs } = currentEquation;
  const tbody = document.getElementById('stoichRows');
  tbody.innerHTML = '';
  const allSpecies = reactants.map((s,i)=>({name:s, role:'Reactant', coeff:coeffs[i]}))
    .concat(products.map((s,i)=>({name:s, role:'Product', coeff:coeffs[reactants.length+i]})));
  allSpecies.forEach((sp, idx) => {
    const { mw, missing } = computeMW(sp.name);
    const mwDisplay = missing.length ? 'unknown' : mw.toFixed(4);
    tbody.insertAdjacentHTML('beforeend', `
      <tr data-idx="${idx}" data-mw="${missing.length?0:mw}">
        <td>${sp.role}</td>
        <td>${formatFormulaHtml(sp.name)}</td>
        <td>${sp.coeff}</td>
        <td>${mwDisplay}</td>
        <td><input type="number" step="0.0001" class="cell-in narrow known-amt" placeholder="amount"></td>
        <td><select class="cell-in known-unit"><option value="g">g</option><option value="mol">mol</option></select></td>
        <td class="calc-out out-mol">&mdash;</td>
        <td class="calc-out out-mass">&mdash;</td>
      </tr>`);
  });
}

function calcStoichFromKnown(){
  const rows = document.querySelectorAll('#stoichRows tr');
  const resultBox = document.getElementById('stoich-result');
  let knownRow = null;
  rows.forEach(row => {
    const amt = row.querySelector('.known-amt').value;
    if (amt !== '' && !isNaN(parseFloat(amt))) knownRow = row;
  });
  if (!knownRow) {
    resultBox.innerHTML = '<div class="calc-error">Enter a known amount for exactly one species.</div>';
    return;
  }
  const knownAmt = parseFloat(knownRow.querySelector('.known-amt').value);
  const knownUnit = knownRow.querySelector('.known-unit').value;
  const knownMw = parseFloat(knownRow.dataset.mw);
  const knownCoeff = parseFloat(knownRow.children[2].textContent);
  if (knownUnit === 'g' && (!knownMw || knownMw <= 0)) {
    resultBox.innerHTML = '<div class="calc-error">Molecular weight unavailable for the known species - cannot convert grams to moles.</div>';
    return;
  }
  const knownMol = knownUnit === 'g' ? knownAmt / knownMw : knownAmt;
  const molPerCoeff = knownMol / knownCoeff;

  rows.forEach(row => {
    const coeff = parseFloat(row.children[2].textContent);
    const mw = parseFloat(row.dataset.mw);
    const mol = molPerCoeff * coeff;
    const mass = mw > 0 ? mol * mw : null;
    row.querySelector('.out-mol').textContent = mol.toFixed(4);
    row.querySelector('.out-mass').textContent = mass !== null ? mass.toFixed(4) + ' g' : 'MW unknown';
  });
  resultBox.innerHTML = `<div class="calc-note" style="margin-top:0;">Calculated from ${knownAmt} ${knownUnit} of the selected species using the balanced-equation mole ratios.</div>`;
}

function buildLimitingTable(){
  const { reactants, coeffs } = currentEquation;
  const tbody = document.getElementById('limitingRows');
  tbody.innerHTML = '';
  reactants.forEach((s, i) => {
    const { mw, missing } = computeMW(s);
    tbody.insertAdjacentHTML('beforeend', `
      <tr data-mw="${missing.length?0:mw}" data-coeff="${coeffs[i]}">
        <td>${formatFormulaHtml(s)}</td>
        <td>${coeffs[i]}</td>
        <td>${missing.length ? 'unknown' : mw.toFixed(4)}</td>
        <td><input type="number" step="0.0001" class="cell-in narrow limiting-amt" placeholder="grams available"></td>
      </tr>`);
  });
}

function calcLimitingReagent(){
  const rows = document.querySelectorAll('#limitingRows tr');
  const resultBox = document.getElementById('limiting-result');
  let entries = [];
  let allFilled = true;
  rows.forEach((row, i) => {
    const amtStr = row.querySelector('.limiting-amt').value;
    const amt = parseFloat(amtStr);
    const mw = parseFloat(row.dataset.mw);
    const coeff = parseFloat(row.dataset.coeff);
    const name = currentEquation.reactants[i];
    if (amtStr === '' || isNaN(amt)) { allFilled = false; return; }
    if (!mw || mw <= 0) { allFilled = false; return; }
    const mol = amt / mw;
    const molPerCoeff = mol / coeff;
    entries.push({ name, amt, mw, coeff, mol, molPerCoeff });
  });
  if (!allFilled || entries.length < 2) {
    resultBox.innerHTML = '<div class="calc-error">Enter an available mass for at least 2 reactants (with known molecular weight) to find the limiting reagent.</div>';
    return;
  }
  entries.sort((a,b) => a.molPerCoeff - b.molPerCoeff);
  const limiting = entries[0];
  const { products, coeffs, reactants } = currentEquation;

  let rowsHtml = entries.map(e => `
    <tr class="${e===limiting ? 'result-highlight' : ''}">
      <td>${formatFormulaHtml(e.name)}${e===limiting ? ' &larr; limiting' : ' (excess)'}</td>
      <td>${e.mol.toFixed(4)} mol available &middot; ${e.molPerCoeff.toFixed(4)} mol/coeff</td>
    </tr>`).join('');

  let productRows = products.map((p,i) => {
    const { mw, missing } = computeMW(p);
    const pCoeff = coeffs[reactants.length+i];
    const mol = limiting.molPerCoeff * pCoeff;
    const mass = missing.length ? null : mol * mw;
    return `<tr class="result-highlight"><td>Theoretical yield of ${formatFormulaHtml(p)}</td><td>${mol.toFixed(4)} mol${mass!==null ? ' = ' + mass.toFixed(4) + ' g' : ''}</td></tr>`;
  }).join('');

  resultBox.innerHTML = `<table class="result-table">${rowsHtml}${productRows}</table>`;
}

function toggleLimiting(){
  const sec = document.getElementById('limitingSection');
  const icon = document.getElementById('limitingToggleIcon');
  const showing = sec.style.display !== 'none';
  sec.style.display = showing ? 'none' : 'block';
  icon.innerHTML = showing ? '&#9656;' : '&#9662;';
}

/* ==============================
   Element picker - generalized to insert into any target input
============================== */
/* ==============================
   Reference Tab - live Formula -> MW calculator
============================== */
function calcRefFormula(){
  const formula = document.getElementById('refFormulaInput').value.trim();
  const out = document.getElementById('refFormulaResult');
  if (!formula) { out.innerHTML = ''; return; }
  const { mw, comp, missing } = computeMW(formula);
  if (missing.length > 0) {
    out.innerHTML = `<div class="calc-error">Unrecognized element symbol(s): ${escapeHtml(missing.join(', '))}</div>`;
    return;
  }
  const compStr = Object.entries(comp).map(([el,ct]) => `${el}<sub>${ct}</sub>`).join(' ');
  out.innerHTML = `
    <table class="result-table">
      <tr><td>Formula</td><td>${escapeHtml(formula)}</td></tr>
      <tr><td>Composition</td><td>${compStr}</td></tr>
      <tr class="result-highlight"><td>Molecular weight</td><td>${mw.toFixed(4)} g/mol</td></tr>
    </table>`;
}

function insertElementInto(selectEl, targetInputId){
  const symbol = selectEl.value;
  if (!symbol) return;
  const input = document.getElementById(targetInputId);
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + symbol + input.value.slice(end);
  input.focus();
  input.setSelectionRange(start + symbol.length, start + symbol.length);
  selectEl.value = "";
  input.dispatchEvent(new Event('input'));
}

/* Init */
calcTolerance();
document.getElementById('refInsertEl').innerHTML += elementOptionsHtml();
doBalance();
