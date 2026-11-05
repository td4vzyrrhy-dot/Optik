const book = document.querySelector('#book');
const pageRight = document.querySelector('.page-right');
pageRight.style.overflowY = 'auto';
pageRight.style.overflowX = 'hidden';
document.querySelectorAll('.hotspot').forEach((hotspot) => {
  const savedPosition = localStorage.getItem(`fina-hotspot-${hotspot.classList[1]}`);
  if (!savedPosition) return;
  const { left, top } = JSON.parse(savedPosition);
  hotspot.style.left = `${left}%`;
  hotspot.style.top = `${top}%`;
});
const closeBook = document.querySelector('#close-book');
const nextPage = document.querySelector('#next-page');
const prevPage = document.querySelector('#prev-page');
window.cave7HTML = `<h1>Kapitel 7 – Die gewölbte Kammer</h1><h2>Das Geheimnis des zerstreuten Lichts</h2><p>Als Fina das Rätsel des Hohlspiegels gelöst hatte, begann der kleine Stein im Brennpunkt golden zu leuchten.</p><p>Eine schwere Steintür öffnete sich.</p><p>Dahinter führte eine schmale Treppe in eine weitere Kammer.</p><p>Fina folgte Lumi neugierig.</p><p>Als sie eintrat, blieb sie überrascht stehen.</p><p>Überall ragten glänzende, silberne Felsen aus dem Boden.</p><p>Doch anders als in der letzten Grotte waren ihre Oberflächen nach außen gewölbt, wie die Außenseite einer Kugel.</p><p>„Das ist ja genau andersherum!“, stellte Fina fest.</p><p>Sie näherte sich einem der glänzenden Felsen und betrachtete ihr Spiegelbild.</p><p>„Huch!“</p><p>Fina ging einen Schritt zurück.</p><p>„Lumi, ich bin ja winzig!“</p><p>In der glänzenden Oberfläche sah sie einen kleinen Fuchs. Sie hob eine Pfote, und das Spiegelbild machte die Bewegung mit.</p><p>Fina musste lachen.</p><p>„So klein war ich noch nie!“</p><p>Dann bemerkte sie etwas anderes.</p><p>Im Spiegel konnte sie nicht nur sich selbst sehen. Auch die Steinsäulen hinter ihr, einen Teil der Höhlendecke und sogar den Eingang der Kammer erkannte sie.</p><p>Fina drehte sich überrascht um.</p><p>„Moment mal! In einem ebenen Spiegel konnte ich viel weniger von meiner Umgebung sehen.“</p><p>Sie betrachtete die gewölbte Oberfläche.</p><p>„Vielleicht hängt das mit der Form zusammen.“</p><p>Lumi schwebte zu einer kleinen Öffnung in der Felswand.</p><p>„Vielleicht solltest du dir auch hier den Weg des Lichts ansehen.“</p><p>Durch die Öffnung fielen drei schmale, parallele Lichtstreifen.</p><p>Sie trafen auf einen großen, nach außen gewölbten Spiegelstein.</p><p>Fina beobachtete gespannt die Reflexion.</p><p>Doch diesmal geschah etwas ganz anderes als in der letzten Grotte.</p><p>Die zurückgeworfenen Lichtstreifen entfernten sich voneinander.</p><p>„Das ist ja merkwürdig!“, rief Fina.</p><p>Sie betrachtete den Spiegelstein von der Seite.</p><p>„Beim Hohlspiegel haben sich die Lichtstrahlen getroffen. Hier laufen sie auseinander.“</p><p>Sie erinnerte sich an das Reflexionsgesetz.</p><p>„Dabei müsste das Gesetz doch auch hier gelten.“</p><p>Lumi nickte.</p><p>„Vielleicht hilft es dir, die beiden Spiegel genauer zu vergleichen.“</p><p>Fina nahm ihr Forschungsheft hervor.</p><p>Sie zeichnete einen nach innen und einen nach außen gewölbten Spiegel nebeneinander.</p><p>„Die Formen sind unterschiedlich“, überlegte sie. „Vielleicht werden die Lichtstrahlen deshalb in verschiedene Richtungen zurückgeworfen.“</p><p>Sie blickte erneut in den großen Spiegelstein.</p><p>Noch immer konnte sie darin einen erstaunlich großen Teil der Kammer erkennen.</p><p>„Und vielleicht erklärt das auch, warum ich hier so viel mehr sehen kann.“</p><p>In diesem Moment begann eine Tür am anderen Ende der Kammer zu leuchten.</p><p>Darüber erschien eine Inschrift:</p><p><em>Wer nur einen kleinen Ausschnitt sieht, übersieht vielleicht die Gefahr. Wer den Überblick behält, findet den sicheren Weg.</em></p><p>Fina las die Worte zweimal.</p><p>„Den Überblick behalten?“</p><p>Sie dachte an eine unübersichtliche Wegkreuzung im Wald.</p><p>„Vielleicht könnte so ein Spiegel sogar dort nützlich sein.“</p><p>Lumi lächelte.</p><p>„Aber zuerst musst du herausfinden, wie er funktioniert.“</p>`;
let currentPages = [];
let currentPage = 0;
function showPage() {
  document.querySelector('#placeholder').innerHTML = currentPages[currentPage] || '';
  nextPage.hidden = currentPage >= currentPages.length - 1;
  prevPage.hidden = currentPage === 0;
  nextPage.textContent = `Nächste Seite  →  (${currentPage + 1}/${currentPages.length})`;
  document.querySelector('.page-right').scrollTop = 0;
}
let bookTimer;
document.querySelectorAll('.hotspot').forEach((hotspot, index) => {
  hotspot.addEventListener('click', () => {
    const label = index === 0 ? 'dem Fuchs' : `Höhle ${index}`;
    if (index === 0 || index === 1 || index === 2 || index === 3 || index === 4 || index === 5 || index === 6 || index === 7 || index === 8 || index === 9 || index === 10) {
      const story = index === 10 ? window.cave8HTML : index === 9 ? window.cave9HTML : index === 8 ? window.cave10HTML : index === 7 ? window.cave7HTML : index === 6 ? window.cave6HTML : index === 5 ? window.cave5HTML : index === 0 ? window.prologHTML : index === 1 ? window.cave2HTML : index === 2 ? window.cave3HTML : index === 3 ? window.cave4ShadowHTML : window.cave4HTML;
      const normalizedStory = story;
      let paragraphs = normalizedStory.match(/<(?:h1|h2|p)>[\s\S]*?<\/(?:h1|h2|p)>/g) || [];
      if (paragraphs.length === 0) paragraphs = [`<p class="placeholder-text">Platzhalter für Höhle ${index}</p>`];
      currentPages = [];
      let page = '';
      let paragraphCount = 0;
      paragraphs.forEach((part) => {
        if (part.startsWith('<p>')) paragraphCount += 1;
        const limitReached = page.length > (index === 1 ? 1310 : index === 3 ? 1900 : index === 6 ? 1700 : index === 5 ? 1250 : index === 7 ? (currentPages.length === 0 ? 1150 : currentPages.length === 1 ? 1580 : 1800) : index === 8 ? (currentPages.length === 0 ? 1340 : currentPages.length === 1 ? 1350 : 1400) : index === 9 ? (currentPages.length === 0 ? 1250 : currentPages.length === 1 ? 1300 : 1500) : index === 10 ? 1300 : 1400) || (index === 3 && paragraphCount > 22) || (index === 6 && paragraphCount > 20) || (index === 5 && paragraphCount > 18) || (index === 7 && paragraphCount > (currentPages.length === 0 ? 16 : currentPages.length === 1 ? 24 : 26));
        if (limitReached && part.startsWith('<p>')) { currentPages.push(page); page = ''; paragraphCount = 1; }
        page += part;
      });
      if (page) currentPages.push(page);
      currentPage = 0;
      showPage();
    } else {
      currentPages = [`<p>Hier steht später der Text zu ${label}.</p>`];
      currentPage = 0;
      showPage();
    }
    const map = document.querySelector('.map');
    map.style.setProperty('--light-x', `${hotspot.offsetLeft + hotspot.offsetWidth / 2}px`);
    map.style.setProperty('--light-y', `${hotspot.offsetTop + hotspot.offsetHeight / 2}px`);
    map.classList.add('lit');
    clearTimeout(bookTimer);
    bookTimer = setTimeout(() => { book.hidden = false; }, 850);
  });
});
closeBook.addEventListener('click', () => { book.hidden = true; });
nextPage.addEventListener('click', () => { if (currentPage < currentPages.length - 1) { currentPage += 1; showPage(); } });
prevPage.addEventListener('click', () => { if (currentPage > 0) { currentPage -= 1; showPage(); } });
book.addEventListener('click', (event) => { if (event.target === book) book.hidden = true; });
