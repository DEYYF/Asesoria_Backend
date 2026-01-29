const synonyms = {
    "pechuga de pollo": "pollo",
    "pollo troceado": "pollo",
    "muslo de pollo": "pollo",
    "ternera picada": "ternera",
    "filete de ternera": "ternera",
    "lomo de cerdo": "cerdo",
    "atun al natural": "atun",
    "atun en aceite": "atun",
    "leche desnatada": "leche",
    "leche entera": "leche",
    "arroz blanco": "arroz",
    "arroz integral": "arroz",
    "pasta integral": "pasta",
    "macarrones": "pasta",
    "espaguetis": "pasta"
};

const categoryMapping = {
    "pollo": "Carnes",
    "ternera": "Carnes",
    "cerdo": "Carnes",
    "pavo": "Carnes",
    "atun": "Pescados",
    "salmon": "Pescados",
    "merluza": "Pescados",
    "leche": "Lácteos",
    "queso": "Lácteos",
    "yogur": "Lácteos",
    "arroz": "Legumbres/Cereales",
    "pasta": "Legumbres/Cereales",
    "lentejas": "Legumbres/Cereales",
    "garbanzos": "Legumbres/Cereales",
    "manzana": "Frutas",
    "platano": "Frutas",
    "lechuga": "Verduras",
    "tomate": "Verduras",
    "cebolla": "Verduras"
};

/**
 * Normaliza el nombre del ingrediente usando el mapa de sinónimos.
 */
function getNormalizedName(name) {
    if (!name) return "";
    const lower = name.toLowerCase().trim();
    return synonyms[lower] || lower;
}

/**
 * Devuelve una categoría sugerida si no tiene una asignada.
 */
function getSuggestedCategory(name) {
    const normalized = getNormalizedName(name);
    return categoryMapping[normalized] || "General";
}

module.exports = {
    getNormalizedName,
    getSuggestedCategory
};
