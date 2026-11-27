const moscowDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

if (moscowDate >= '2027-01-01') {
  document.querySelector('#session-price').textContent = '18 000 ₽';
  document.querySelector('#session-note').remove();
}
