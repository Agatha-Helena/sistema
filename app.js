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
        await db.query(`DELETE FROM ${tabela} WHERE id = ?`, [id]);
        res.redirect(volta)
    } catch (error) {
        if(error.code === 'ER_ROW_IS_REFERENCED_2'){
            return res.status(409).send(`<p>Não foi possível excluir: ${motivo}.</p><p><a href='${volta}'>Voltar</a></p>`)
        }
        console.error(error)
        res.status(500).send(`<p>Erro ao excluir.</p><p><a href='${volta}'>Voltar</a></p>`)
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

app.put('/pacientes/:id', async (req, res) => {
    const { nome, cpf, telefone, email } = req.body;
    await db.query(
        "UPDATE pacientes SET nome = ?, cpf = ?, telefone = ?, email = ? WHERE id = ?", [nome, criptografar(cpf), telefone, email, req.params.id]
    )
    res.redirect("/pacientes")
})

app.delete('/pacientes/:id', async(req,res) => {
    await excluir(res, 'pacientes', req.params.id,'/pacientes', 'o paciente possui tratamento agendado')
})

async function mostrarTratamentos(req, res, erro = ''){
    const [tratamentos] = await db.query('SELECT * FROM tratamentos')

    const [listaPacientes] = await db.query('SELECT id_paciente, nome FROM pacientes')

    const editar = tratamentos.find(t => String(t.id_tratamento) === req.query.editar)

    const pacientes = listaPacientes.map((paciente) => ({
        ...paciente,
        selecionado: editar && paciente.id === editar.paciente_id ? 'selected' : ''
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
    const {cliente_id, placa, marca, modelo, ano} = req.body

    if(!cliente_id){
        return mostrarVeiculos(req,res, 'cliente_id é obrigatório')
    }

    await db.query ('INSERT INTO veiculos (cliente_id, placa, marca, modelo, ano) VALUES (?, ?, ?, ?, ?)', [cliente_id, placa, marca, modelo, ano || null])

    res.redirect('/veiculos')
})

app.put('/veiculos/:id', async (req,res) => {
    const {cliente_id, placa, marca, modelo, ano} = req.body

    if(!cliente_id){
        return mostrarVeiculos(req, res, 'cliente_id e obrigatorio')
    }

    await db.query('UPDATE veiculos SET cliente_id = ?, placa = ?, marca = ?, modelo = ?, ano = ? WHERE id = ?', [cliente_id, placa, marca, modelo, ano || null, req.params.id])

    res.redirect('/veiculos')
})

app.delete('/veiculos/:id', async (req, res) =>{
    await excluir(res, 'veiculos', req.params.id, '/veiculos', 'o veiculo possui agendamento')
})

// -------------

app.get("/agendamentos", async (req, res) => {
  const [lista] = await db.query(
    "SELECT agendamentos.*, veiculos.placa, veiculos.marca, veiculos.modelo, clientes.nome AS cliente_nome FROM agendamentos JOIN veiculos ON veiculos.id = agendamentos.id_veiculo JOIN clientes ON clientes.id = veiculos.cliente_id ORDER BY agendamentos.data_agendamento ASC",
  );

  const [veiculos] = await db.query("SELECT * FROM veiculos");

  const agendamentos = lista.map((a) => ({
    ...a,
    data_br: new Date(a.data_agendamento).toLocaleString("pt-BR"),
    data_input: a.data_agendamento.slice(0, 16).replace(" ", "T"),
  }));
  res.send(mostrar("agendamentos", { agendamentos, veiculos }));
});

app.post("/agendamentos", async (req, res) => {
  const { id_veiculo, data_agendamento, servico } = req.body;

  await db.query(
    "INSERT INTO agendamentos (id_veiculo, data_agendamento, servico) VALUES (?, ?, ?)",
    [id_veiculo, data_agendamento.replace("", " "), servico],
  );
  res.redirect("/agendamentos");
});

app.put("/agendamentos/:id", async (req, res) => {
  await db.query("UPDATE agendamentos SET data_agendamento = ? WHERE id = ?", [
    req.body.data_agendamento.replace("T", " "),
    req.params.id,
  ]);
  res.redirect("/agendamentos");
});

app.delete("/agendamentos/:id", async (req, res) => {
  await excluir(res, "agendamentos", req.params.id, "/agendamentos", " ")
})

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Fisio+ rodando em http://localhost:${port}`)
})