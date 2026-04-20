const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));
app.use(express.urlencoded({ extended: true }));

// Sesiunea este folosită pentru a stoca autentificarea și coșul
app.use(session({
    secret: 'magazin-parfumuri',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // Sesiune valabilă 24 de ore
}));

// Bază de date simulată cu utilizatori
const users = [];

// Bază de date simulată cu parfumuri
const parfumuri = [
    { id: 1, nume: "Chanel No. 5", categorie: "Apă de Parfum", pret: 750 },
    { id: 2, nume: "Dior Sauvage", categorie: "Apă de Toaletă", pret: 600 },
    { id: 3, nume: "Tom Ford Oud Wood", categorie: "Extract", pret: 1200 },
    { id: 4, nume: "Baccarat Rouge 540", categorie: "Apă de Parfum", pret: 1400 }
];

// Middleware pentru a verifica dacă utilizatorul este autentificat
const requireLogin = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/?mesaj=' + encodeURIComponent('Acces interzis! Te rugăm să te loghezi.'));
    }
};

// Ruta principală - Dacă e logat arată magazin, altfel arată login
app.get('/', (req, res) => {
    if (req.session.user) {
        // Utilizator logat - arată magazin
        const nrProduseCos = req.session.cart ? req.session.cart.reduce((total, item) => total + item.cantitate, 0) : 0;
        res.render('index', { parfumuri: parfumuri, nrProduseCos: nrProduseCos, user: req.session.user });
    } else {
        // Utilizator nelogat - arată pagina de login
        res.render('login', { mesaj: req.query.mesaj || '' });
    }
});

// Ruta pentru înregistrare (GET)
app.get('/register', (req, res) => {
    res.render('login', { mesaj: '' });
});

// Ruta pentru înregistrare (POST)
app.post('/register', (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    // Validare
    if (!name || !email || !password || !confirmPassword) {
        return res.render('login', { mesaj: 'Te rugăm să completezi toate câmpurile!' });
    }

    if (password !== confirmPassword) {
        return res.render('login', { mesaj: 'Parolele nu se potrivesc!' });
    }

    // Verifică dacă utilizatorul există deja
    const userExists = users.find(u => u.email === email);
    if (userExists) {
        return res.render('login', { mesaj: 'Email-ul este deja înregistrat!' });
    }

    // Adaugă utilizatorul nou
    users.push({ name, email, password });
    
    // Redirecționează la login cu mesaj de succes
    res.redirect('/?mesaj=' + encodeURIComponent('inregistrare_succes'));
});

// Ruta pentru login (POST)
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Găsește utilizatorul
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        // Autentificare reușită
        req.session.user = { email: user.email, name: user.name };
        req.session.cart = [];
        res.redirect('/');
    } else {
        // Autentificare eșuată
        res.render('login', { mesaj: 'Email sau parolă incorectă!' });
    }
});

// Ruta pentru logout
app.get('/logout', (req, res) => {
    req.session.user = null;
    req.session.cart = [];
    res.redirect('/');
});

// Ruta pentru adăugarea unui produs în coș (POST) - protejată
app.post('/adauga', requireLogin, (req, res) => {
    const parfumId = parseInt(req.body.id);
    const parfumSelectat = parfumuri.find(p => p.id === parfumId);

    // Inițializare coș dacă nu există
    if (!req.session.cart) {
        req.session.cart = [];
    }

    if (parfumSelectat) {
        // Verificăm dacă produsul este deja în coș
        const produsExistent = req.session.cart.find(item => item.id === parfumId);
        
        if (produsExistent) {
            produsExistent.cantitate += 1; // Creștem cantitatea
        } else {
            // Adăugăm produs nou cu cantitatea 1
            req.session.cart.push({
                id: parfumSelectat.id,
                nume: parfumSelectat.nume,
                pret: parfumSelectat.pret,
                cantitate: 1
            });
        }
    }
    
    res.redirect('/');
});

// Ruta pentru vizualizarea coșului - protejată
app.get('/cos', requireLogin, (req, res) => {
    const cos = req.session.cart || [];
    let totalGeneral = 0;
    
    cos.forEach(item => {
        totalGeneral += item.pret * item.cantitate;
    });

    res.render('cos', { cos: cos, total: totalGeneral });
});

// Ruta pentru golirea coșului - protejată
app.get('/goleste-cos', requireLogin, (req, res) => {
    req.session.cart = [];
    res.redirect('/cos');
});

app.listen(PORT, () => {
    console.log(`Magazinul rulează la: http://localhost:${PORT}`);
});