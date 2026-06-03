const SMILEYS = [
  { img: '0.gif', codes: [':)', ':-)'] },
  { img: '9.gif', codes: [':))', ':-))'] },
  { img: 'lol.gif', codes: [':lol:', ':лол:'] },
  { img: '10.gif', codes: [':(', ':-('] },
  { img: '12.gif', codes: [':((', ':-(('] },
  { img: '11.gif', codes: ['%-(', '%-)'] },
  { img: '1.gif', codes: [';)', ';-)'] },
  { img: '3.gif', codes: [':-/', ':-\\'] },
  { img: '14.gif', codes: [':-|', ':|'] },
  { img: '13.gif', codes: [':-E'] },
  { img: '18.gif', codes: [':?', ':-?'] },
  { img: '2.gif', codes: ['8-0'] },
  { img: '15.gif', codes: ['8)', '8-)'] },
  { img: '7.gif', codes: ['ЧМОК'] },
  { img: '8.gif', codes: ['ЦЕМ'] },
  { img: '6.gif', codes: ['ПИВО'] },
  { img: 'beer.gif', codes: [':2beer:'] },
  { img: '4.gif', codes: [':OK'] },
  { img: '5.gif', codes: ['shit'] },
  { img: '17.gif', codes: [':heart:', ':сердце:'] },
  { img: 'walkman.gif', codes: ['[:-}', '[:-)'] },
  { img: 'guitar.gif', codes: ['Оо=+', ':guitar:', ':гитара:'] },
  { img: 'baby.gif', codes: [':Oo'] },
  { img: 'a_flower.gif', codes: [':flower:', ':цветок:'] },
  { img: 'flowers.gif', codes: [':flowers:', ':цветы:'] },
  { img: 'rose.gif', codes: ['@}->--', ':rose:', ':роза:'] },
  { img: 'monkey.gif', codes: [':@-', ':monkey:', ':обезьяна:'] },
  { img: 'bleh.gif', codes: [':P', ':-P'] },
  { img: 'red.gif', codes: [':red:', ':стыдно:'] },
  { img: 'haha.gif', codes: [':haha:', ':хаха:'] },
  { img: 'bored.gif', codes: [':-o', ':bored:', ':скука:'] },
  { img: 'boxing.gif', codes: [':boxing:', ':бокс:'] },
  { img: 'eat.gif', codes: [':eat:', ':еда:'] },
  { img: 'angel.gif', codes: ['O:)', 'O:-)'] },
  { img: 'blackeye.gif', codes: ['!-('] },
  { img: 'foul.gif', codes: ['@#$!', ':foul:', ':мат:'] },
  { img: 'smoke.gif', codes: [':-Q'] },
  { img: 'handshake.gif', codes: ['--==--'] },
  { img: 'strawberry.gif', codes: ['<>'] },
  { img: '2note.gif', codes: ['././'] },
  { img: 'note.gif', codes: ['./'] },
  { img: 'dance.gif', codes: ['o/-<'] },
  { img: 'sport.gif', codes: [':sport:', ':спорт:'] },
  { img: 'beee.gif', codes: [':bebebe:', ':бебебе:'] },
];

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applySmileys(html) {
  let result = html;
  const sorted = [...SMILEYS].sort((a, b) => {
    const maxA = Math.max(...a.codes.map((c) => c.length));
    const maxB = Math.max(...b.codes.map((c) => c.length));
    return maxB - maxA;
  });

  for (const smiley of sorted) {
    for (const code of smiley.codes) {
      const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'g');
      result = result.replace(
        re,
        `<img src="/i/smile/${smiley.img}" alt="${code}" style="vertical-align:middle">`,
      );
    }
  }
  return result;
}

function renderSmileys(text) {
  return applySmileys(escapeHtml(text));
}

function renderSmileyList() {
  return SMILEYS.map(
    (s) =>
      `<tr><td align="center"><img src="/i/smile/${s.img}"></td><td style="white-space:nowrap">${s.codes.join(' ')}</td></tr>`,
  ).join('\n');
}

export { SMILEYS, applySmileys, escapeHtml, renderSmileys, renderSmileyList };
