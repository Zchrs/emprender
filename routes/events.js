/* 
    rutas de eventos
    host + /api/Event
*/

const { Router } = require("express");
const { validateJwt } = require("../middlewares/validate-jwt");
const { getEvent, createEvent, updateEvent, deleteEvent } = require("../controllers/events");


const router = Router();

// aquí ponemos el middleware para que todas las rutas pasen por ahí
router.use((req, res, next) => {
    validateJwt(req, res, next); 
  });

// Obtener evts
router.get('/', getEvent );

// Create evts
router.post('/', createEvent );

// Update evts
router.put('/:id', updateEvent );

// Update evts
router.delete('/:id', deleteEvent );

module.exports = router;