document.addEventListener("DOMContentLoaded", () => {

/************* CAROUSEL *************/
const track = document.querySelector(".carousel-track");
const slides = document.querySelectorAll(".carousel-track img");
const nextBtn = document.querySelector('.carousel-btn.next');
const prevBtn = document.querySelector('.carousel-btn.prev');

let current = 0;

function showSlide(index) {
  track.style.transform = `translateX(-${index * 100}%)`;
}

nextBtn?.addEventListener('click', () => {
  current = (current + 1) % slides.length;
  showSlide(current);
});

prevBtn?.addEventListener('click', () => {
  current = (current - 1 + slides.length) % slides.length;
  showSlide(current);
});

setInterval(() => {
  current = (current + 1) % slides.length;
  showSlide(current);
}, 10000);


/************* MODAL *************/
const modal = document.getElementById("privacyModal");
const openBtn = document.getElementById("openModal");
const closeBtn = document.querySelector(".close");

openBtn?.addEventListener("click", function(e) {
  e.preventDefault();
  modal.style.display = "block";
});

closeBtn?.addEventListener("click", function() {
  modal.style.display = "none";
});

window.addEventListener("click", function(e) {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});


/************* FORM *************/
const form = document.getElementById('contact');
const msg = document.getElementById('formMsg');
const terms = document.getElementById("terms");

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = Object.fromEntries(new FormData(form));

  const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+$/;
  const numberRegex = /^[0-9]+$/;
  const phoneRegex = /^[0-9]{7,15}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nameRegex.test(data.names)) return showError("El nombre solo debe contener letras.");
  if (!nameRegex.test(data.lastnames)) return showError("Los apellidos solo deben contener letras.");
  if (!numberRegex.test(data.docId) || data.docId.length < 6) return showError("La cédula debe tener mínimo 6 números.");
  if (!phoneRegex.test(data.phone)) return showError("El teléfono debe tener entre 7 y 15 números.");
  if (!emailRegex.test(data.email)) return showError("Ingresa un email válido.");
  if (data.address.trim().length < 5) return showError("La dirección es demasiado corta.");
  if (!terms.checked) return showError("Debes aceptar los términos y condiciones.");

  try {
    // const res = await fetch('https://emprender.friendsforlife.com.co/api/users/auth/register', {
    const res = await fetch('http://localhost:4000/api/users/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.message);

    msg.style.cssText = `
      color: green; 
      font-size: 1.2rem; 
      margin-top: 1rem;
      text-shadow: 1px 1px 2px #def3de, -1px -1px 2px #def3de;
    `;
    msg.textContent = 'Registro enviado correctamente ✅';
    form.reset();

  } catch (error) {
    showError(error.message || 'Error al enviar ❌');
  }
});

function showError(message) {
  msg.style.color = 'red';
  msg.textContent = message;
}

});
