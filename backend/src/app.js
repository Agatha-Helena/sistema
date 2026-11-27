require ('dotenv').config()

const fs = require ('fs')
const path = require ('path')
const express = require ('express')
const mysql = require ('mysql2/promise')
const bcrypt = require ('bcryptjs')
const jwt = require ('jsonwebtoken')
const crypto = require ('crypto')
const cookieParser = require ('cookie-parser')
const mustache = require ('mustache')
const { error } = require('console')

const app = express()
app.use(express.urlencoded({extended: false}))
app.use(cookieParser())

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true
})

app.use((req,res,next) => {
    const metodo = String(req.body?._method || '').toUpperCase()

    if(req.method === 'POST' && ['PUT', 'DELETE'].includes(metodo)){
        req.method = metodo
    }
    next()
})

function mostrar(nome, dados = {}){
    const arquivo = path.join(__dirname, 'paginas', `${nome}.html`)

    return mustache.render(fs.readFileSync(arquivo, 'utf8'), dados)
}

function criptografar(texto){
    const cifra = crypto.createCipheriv('aes-256-cbc', process.env.CRIPTO_CHAVE, process.env.CRIPTO_IV)

    return cifra.update(texto, 'utf8', 'hex') + cifra.final('hex')
}

function descriptografar(texto){
    const decifra = crypto.createDecipheriv ('aes-256-cbc', process.env.CRIPTO_CHAVE, process.env.CRIPTO_IV)

    return decifra.update(texto, 'hex', 'utf8') + decifra.final('utf8')
}

async function excluir(res, tabela, id, volta, motivo) {
    try {
        await db.query(`DELETE FROM ${tabela} WHERE id = ?`, [id])
        res.redirect(volta)
    } catch (error) {
        if(error.code === 'ER_ROW_IS_REFERENCED_2'){
            return res.status(409).send(`<p>Nao foi possivel excluir: ${motivo}.</p><p><a href='${volta}'>Voltar</a></p>`)
        }
        console.error(error)
        res.status(500).send(`<p>Erro ao excluir.</p><p><a href='${voltar}'>Voltar</a></p>`)
    }
}

app.get('/', (req,res) => {
    res.send(mostrar('login'))
})

app.post('/login', async(req,res) =>{
    const{email, senha} = req.body
    const [usuarios] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email])
    const usuario = usuarios[0]

    if(!usuario || !(await bcrypt.compare(senha, usuario.senha))){
        return res.send(mostrar('login', {erro: 'E-mail ou senha invalidos.'}))
    }
        
    const token = jwt.sign({id: usuario.id, nome: usuario.nome}, process.env.JWT_SECRET, {expiresIn: '1h'})

    res.cookie('token', token, {httpOnly: true})
    res.redirect('/principal')
})

app.post('/sair', (req, res) => {
    res.clearCookie('token')
    res.redirect('/')
})

app.use((req, res, next) => {
    try {
        req.usuario = jwt.verify(req.cookies.token, process.env.JWT_SECRET)
        next()
    } catch (erro) {
        res.redirect('/')
    }
})

app.get('/principal', (req, res) => {
    res.send(mostrar('principal', {nome: req.usuario.nome}))
})

app.get('/pacientes', async(req, res) =>{
    const busca = req.query.busca || ''
    const [lista] = await db.query('SELECT * FROM pacientes WHERE nome LIKE ?', [`%${busca}%`])
    const pacientes = lista.map((paciente) => ({...paciente, cpf: descriptografar(paciente.cpf)}))
    const editar = pacientes.find((paciente) => String (paciente.id) === req.query.editar)
    res.send(mostrar('pacientes', {
        pacientes,
         busca,
         editando: Boolean(editar),
         acao: editar ? `/pacientes/${editar.id}`: `/pacientes`,
         form: editar || {}
        }
    ))
})

app.post('/pacientes', async(req,res) =>{
    const {nome, cpf, telefone, email} = req.body
    await db.query('INSERT INTO pacientes (nome, cpf, telefone, email) VALUES (?, ?, ?, ?)', [nome, criptografar(cpf), telefone, email])
    res.redirect('/pacientes')
})

app.delete('/pacientes/:id', async(req,res) => {
    await excluir(res, 'pacientes', req.params.id,'/pacientes', 'o paciente possui tratamentos cadastrados')
})

async function mostrarTratamentos(req, res, erro = ''){
    const [tratamentos] = await db.query('SELECT * FROM tratamentos')

    const [listaPacientes] = await db.query('SELECT id, nome FROM pacientes')

    const editar = tratamentos.find(v => String(v.id) === req.query.editar)

    const pacientes = listaPacientes.map((paciente) => ({
        ...paciente,
        selecionado: editar && paciente.id === editar.id_paciente ? 'selected' : ''
    }))

    res.send(mostrar('tratamentos', {
        tratamentos,
         pacientes,
         erro,
         editando: Boolean(editar),
         acao: editar ? `/tratamentos/${editar.id}` : `/tratamentos`,
         form: editar || {}
    }))
}

app.get('/tratamentos', (req, res) => mostrarTratamentos(req, res))

app.post('/tratamentos', async (req, res) =>{
    const {id_paciente, tratamento, preco} = req.body

    if(!id_paciente){
        return mostrarTratamentos(req,res, 'id_paciente é obrigatório')
    }

    await db.query ('INSERT INTO tratamentos (id_paciente, tratamento, preco) VALUES (?, ?, ?)', [id_paciente, tratamento, preco || null])

    res.redirect('/tratamentos')
})

app.put('/tratamentos/:id', async (req,res) => {
    const {id_paciente, tratamento, preco} = req.body

    if(!id_paciente){
        return mostrarTratamentos(req, res, 'id_paciente e obrigatorio')
    }

    await db.query('UPDATE tratamentos SET id_paciente = ?, tratamento = ?, preco = ? WHERE id = ?', [id_paciente, tratamento, preco || null, req.params.id])
})

app.delete('/tratamentos/:id', async (req, res) =>{
    await excluir(res, 'tratamentos', req.params.id, '/tratamentos', 'o tratamento possui agendamento')
})

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Sistema Fisio+ rodando em http://localhost:${port}`)
})