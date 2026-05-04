const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const mongoose = require('mongoose');
const User = require('./models/User');
const Parfum = require('./models/Parfum');

const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'view'));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Middleware pentru parsarea cookie-urilor

// Sesiunea este folosită pentru a stoca autentificarea și coșul
app.use(session({
    secret: 'magazin-parfumuri',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // Sesiune valabilă 24 de ore
}));

// Conexiunea la MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/gestiune-parfumuri')
    .then(() => console.log('Conectat cu succes la MongoDB!'))
    .catch(err => console.error('Eroare la conectarea la MongoDB:', err));


// Middleware pentru gestionarea cookie-ului personalizat de temă
app.use((req, res, next) => {
    // Setează tema implicită 'light' dacă nu există cookie
    if (!req.cookies.tema) {
        res.cookie('tema', 'light', { 
            maxAge: 1000 * 60 * 60 * 24 * 30, // Valabil 30 de zile
            httpOnly: false // Accesibil și din JavaScript client-side
        });
        req.cookies.tema = 'light';
    }
    next();
});

// Bază de date simulată cu parfumuri - va fi înlocuită cu MongoDB
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
        res.render('index', { 
            parfumuri: parfumuri, 
            nrProduseCos: nrProduseCos, 
            user: req.session.user,
            tema: req.cookies.tema // Pasează cookie-ul de temă la template
        });
    } else {
        // Utilizator nelogat - arată pagina de login
        res.render('login', { 
            mesaj: req.query.mesaj || '',
            tema: req.cookies.tema // Pasează cookie-ul de temă la login
        });
    }
});

// Ruta pentru înregistrare (GET)
app.get('/register', (req, res) => {
    res.render('login', { 
        mesaj: '',
        tema: req.cookies.tema // Pasează cookie-ul de temă la template
    });
});

// Ruta pentru înregistrare (POST)
app.post('/register', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    // Validare
    if (!name || !email || !password || !confirmPassword) {
        return res.render('login', { 
            mesaj: 'Te rugăm să completezi toate câmpurile!',
            tema: req.cookies.tema
        });
    }

    if (password !== confirmPassword) {
        return res.render('login', { 
            mesaj: 'Parolele nu se potrivesc!',
            tema: req.cookies.tema
        });
    }

    try {
        // Verifică dacă utilizatorul există deja
        const userExists = await User.findOne({ $or: [{ email }, { username: name }] });
        if (userExists) {
            return res.render('login', { 
                mesaj: 'Email-ul sau numele de utilizator este deja înregistrat!',
                tema: req.cookies.tema
            });
        }

        // Creează utilizatorul nou
        const newUser = new User({
            username: name,
            email,
            password
        });

        await newUser.save();
        
        // Redirecționează la login cu mesaj de succes
        res.redirect('/?mesaj=' + encodeURIComponent('inregistrare_succes'));
    } catch (error) {
        console.error('Eroare la înregistrare:', error);
        res.render('login', { 
            mesaj: 'Eroare la înregistrare. Te rugăm să încerci din nou.',
            tema: req.cookies.tema
        });
    }
});

// Ruta pentru login (POST)
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Găsește utilizatorul
        const user = await User.findOne({ email });

        if (user && await user.comparePassword(password)) {
            // Autentificare reușită
            req.session.user = { email: user.email, name: user.username, role: user.role };
            req.session.cart = [];
            res.redirect('/');
        } else {
            // Autentificare eșuată
            res.render('login', { 
                mesaj: 'Email sau parolă incorectă!',
                tema: req.cookies.tema
            });
        }
    } catch (error) {
        console.error('Eroare la login:', error);
        res.render('login', { 
            mesaj: 'Eroare la autentificare. Te rugăm să încerci din nou.',
            tema: req.cookies.tema
        });
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

    res.render('cos', { 
        cos: cos, 
        total: totalGeneral,
        tema: req.cookies.tema // Pasează cookie-ul de temă la template
    });
});

// Ruta pentru golirea coșului - protejată
app.get('/goleste-cos', requireLogin, (req, res) => {
    req.session.cart = [];
    res.redirect('/cos');
});

// Ruta pentru schimbarea temei (light/dark)
app.get('/schimba-tema', (req, res) => {
    const temaActuala = req.cookies.tema || 'light';
    const temaNova = temaActuala === 'light' ? 'dark' : 'light';
    
    res.cookie('tema', temaNova, { 
        maxAge: 1000 * 60 * 60 * 24 * 30, // Valabil 30 de zile
        httpOnly: false
    });
    
    // Redirecționează la pagina anterioară sau la home
    const referer = req.get('referer') || '/';
    res.redirect(referer);
});

app.listen(PORT, () => {
    console.log(`Magazinul rulează la: http://localhost:${PORT}`);
});
