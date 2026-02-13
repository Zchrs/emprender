const jwt = require('jsonwebtoken');

const generateJwt = (id, name, email ) =>{

    return new Promise( (resolve, reject) => {
        const payload = {id, name, email };
        jwt.sign( payload, process.env.SECRET_JWT_SEED, {
            expiresIn: '2h',
        })
    }, ( err, token )=>{
        if (err) {
            console.log(err);
            reject(`Can't generate token`);
        }
        resolve( token );
    })
}

const generateJwtAdmin = (id, fullname, email ) =>{

    return new Promise( (resolve, reject) => {
        const payload = {id, fullname, email };
        jwt.sign( payload, process.env.SECRET_JWT_SEED_ADM, {
            expiresIn: '2h',
        })
    }, ( err, token )=>{
        if (err) {
            console.log(err);
            reject(`Can't generate token`);
        }
        resolve( token );
    })
}

const generateJwtAdvisor = (id, name, lastname, email ) =>{

    return new Promise( (resolve, reject) => {
        const payload = {id, name, lastname, email };
        jwt.sign( payload, process.env.SECRET_JWT_SEED_ADV, {
            expiresIn: '2h',
        })
    }, ( err, token )=>{
        if (err) {
            console.log(err);
            reject(`Can't generate token`);
        }
        resolve( token );
    })
}

module.exports = {
    generateJwt,
    generateJwtAdmin,
    generateJwtAdvisor
}