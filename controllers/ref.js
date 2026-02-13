let propertyRefArr = [];

// Inicializar array de referencias
for (let i = 100; i <= 10000; i++) {
  propertyRefArr.push(i <= 1000 ? `ULSM#${i}` : `US#${i}`);
}

// Función para obtener referencia aleatoria única
const getRandomRef = () => {
  if (propertyRefArr.length === 0) {
    throw new Error('No hay más referencias disponibles');
  }
  
  const randomIndex = Math.floor(Math.random() * propertyRefArr.length);
  const [removedRef] = propertyRefArr.splice(randomIndex, 1);
  return removedRef;
};

// Función para verificar si una referencia existe
const checkRefExists = (ref) => {
  return !propertyRefArr.includes(ref);
};

module.exports = {
  getRandomRef,
  checkRefExists
};