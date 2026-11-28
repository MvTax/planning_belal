// Retour haptique [P10] : un « tic » sous le doigt confirme l'action sans avoir à regarder.
// Safari iOS ne connaît pas navigator.vibrate ; depuis iOS 18, basculer un <input type="checkbox" switch>
// produit le retour haptique du système. On s'en sert à l'intérieur d'un geste de l'utilisateur.
let label = null;

function interrupteur() {
  if (label) return label;
  label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

export function tic(fort = false) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(fort ? 18 : 8);
      return;
    }
    interrupteur().click();
  } catch {
    /* pas de retour haptique : l'animation visuelle suffit */
  }
}
