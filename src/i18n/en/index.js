// Dictionnaire anglais : un fichier par groupe d'écrans, réunis ici.
// Clé = texte français exact passé à t(), valeur = traduction anglaise.
import shell from "./shell";
import feed from "./feed";
import explore from "./explore";
import portfolio from "./portfolio";
import data from "./data";

export default { ...data, ...shell, ...feed, ...explore, ...portfolio };
