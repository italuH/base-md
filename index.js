const { default: gustaConn, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore } = require("@adiwajshing/baileys")
const pino = require('pino')
const chalk = require('chalk')
const { green, redBright, magenta } = chalk
const { Boom } = require('@hapi/boom')
const moment = require('moment-timezone')

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('qr')
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(`Vesão do WaWeb v${version.join('.')}`)
    const gusta = gustaConn({
        browser: ["MD-Bot V0.1", "0.0.1", "Opera"],
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        syncFullHistory: true,
        keepAliveIntervalMs: 60000,
        store,
        version
    })
    store.bind(gusta.ev)

    store.readFromFile('./store.json')
    setInterval(() => {
        store.writeToFile('./store.json')
    }, 10000)

    gusta.ws.on('open', async () => {
        console.log(`BOT-MD v1 conectado com sucesso!`)
    })

    gusta.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (update.isOnline) return
        if (connection === 'close') {
            let reason = new Boom(lastDisconnect.error).output.statusCode
            if (reason === DisconnectReason.badSession) { console.log(`Arquivo de sessão inválido, exclua a sessão e verifique novamente!`); gusta.logout(); }
            else if (reason === DisconnectReason.connectionClosed) { console.log("Conexão fechada, reconectando...."); start(); }
            else if (reason === DisconnectReason.connectionLost) { console.log("Conexão perdida do servidor, reconectando..."); start(); }
            else if (reason === DisconnectReason.connectionReplaced) { console.log("Conexão substituída, uma nova sessão foi aberta, feche a sessão atual primeiro"); gusta.logout() }
            else if (reason === DisconnectReason.restartRequired) { console.log("Reinicialização necessária, reinicializando..."); start(); }
            else if (reason === DisconnectReason.timedOut) {
                console.log("Tempo esgotado, reconectado..."); start();
            } else {
                console.log(redBright(`Motivo de desconexão: ${reason}|${connection}`)); start();
            }

        }
        console.log(magenta('Conectado...'), update)
    })

    gusta.ev.on('creds.update', saveCreds)

    const getGroupAdmins = (participants) => {
        let admins = []
        for (let i of participants) {
            i.admin === "superadmin" ? admins.push(i.id) :  i.admin === "admin" ? admins.push(i.id) : ''
        }
        return admins || []
      }

      const color = (text, color) => {
        return !color ? chalk.green(text) : chalk.keyword(color)(text)
      }

    gusta.ev.on('messages.upsert', async (mop) => {
       

        try {
            msg = mop.messages[0]
            if (!msg.message) return
            msg.message = (Object.keys(msg.message)[0] === 'ephemeralMessage') ? msg.message.ephemeralMessage.message : msg.message
            const from = msg.key.remoteJid
            const type = Object.keys(msg.message).find((key) => !['senderKeyDistributionMessage', 'messageContextInfo'].includes(key))
            const time = moment.tz('America/Sao_Paulo').format('HH:mm:ss')
            const content = JSON.stringify(msg.message)
            const pushname = msg.key.fromMe ? gusta.user.name : msg.pushName || 'Nome não detectado'
            const prefix = "="
            //_MSGS - TEXTO - COMANDOS
            const text = (type === 'conversation' && msg.message.conversation.startsWith(prefix)) ? msg.message.conversation : (type == 'imageMessage') && msg.message.imageMessage.caption.startsWith(prefix) ? msg.message.imageMessage.caption : (type == 'videoMessage') && msg.message.videoMessage.caption.startsWith(prefix) ? msg.message.videoMessage.caption : (type == 'extendedTextMessage') && msg.message.extendedTextMessage.text.startsWith(prefix) ? msg.message.extendedTextMessage.text : (type == 'buttonsResponseMessage') && msg.message.buttonsResponseMessage.selectedButtonId.startsWith(prefix) ? msg.message.buttonsResponseMessage.selectedButtonId : (msg.message.listResponseMessage && msg.message.listResponseMessage.singleSelectReply.selectedRowId.startsWith(prefix) && msg.message.listResponseMessage.singleSelectReply.selectedRowId) ? msg.message.listResponseMessage.singleSelectReply.selectedRowId : (type == 'documentMessage') ? msg.message.documentMessage.title.startsWith(prefix) : (type == 'locationMessage') ? msg.message.locationMessage.name.startsWith(prefix) : (type == 'requestPaymentMessage') ? msg.message.requestPaymentMessage.noteMessage.extendedTextMessage.text : (type == 'contactMessage') ? msg.message.contactMessage.displayName : (type == 'productMessage') ? msg.message.productMessage.product.title : (type == 'liveLocationMessage') ? msg.message.liveLocationMessage.caption : (type == 'listResponseMessage') ? msg.message.extendedTextMessage.contextInfo.listResponseMessage.singleSelectReply.selectedReply.selectedRowId : (type == 'templateButtonReplyMessage') ? msg.message.templateButtonReplyMessage.selectedId : ''
            const txt = (typeof msg.message.conversation == 'string' ? msg.message.conversation : '')
            const comando = text.slice(1).trim().split(/ +/).shift().toLowerCase()
            const cmd = comando
            const args = text.trim().split(/ +/).slice(1)
            const q = args.join(' ')
            const testat = txt.toLowerCase()
            //_USERS - GRUPOS
            const isBaileys = msg.key.id.startsWith('BAE5') && msg.key.id.length === 16
            const grupo = from.endsWith("@g.us") ? true : false
            const sender = msg.key.fromMe ? gusta.user.id.split(':')[0] + '@s.whatsapp.net' : grupo ? msg.key.participant : msg.key.remoteJid || ''
            const botNumber = gusta.user.id.split(':')[0] + '@s.whatsapp.net'
            const dono = [botNumber, 'NUMERO DO DONO'].map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(sender)
            const groupMetadata = grupo ? await gusta.groupMetadata(from).catch(e => { }) : ''
            const groupName = grupo ? groupMetadata.subject : ''
            const participants = grupo ? await groupMetadata.participants : ''
            const groupAdmins = grupo ? getGroupAdmins(participants) : ''
            const botAdmin = grupo ? groupAdmins.includes(botNumber) : false
            const admin = dono ? true : grupo ? groupAdmins.includes(sender) : false

            if (msg.key.remoteJid == 'status@broadcast') console.log(color('STATUS', 'green'), color('HORA:', 'yellow'), color(moment.tz('America/Sao_Paulo').format('HH:mm:ss'), 'yellow'), 'DE:', color(pushname)); if (msg.key.remoteJid == 'status@broadcast') return;
            if (!grupo && cmd) console.log(color('COMANDO RECEBIDO', 'aqua'), color('HORA:', 'yellow'), color(moment.tz('America/Sao_Paulo').format('HH:mm:ss'), 'yellow'), color('COMANDO:'), color(`${comando}`), 'DE:', color(pushname))
            if (cmd && grupo) console.log(color('COMANDO RECEBIDO', 'aqua'), color('HORA:', 'yellow'), color(moment.tz('America/Sao_Paulo').format('HH:mm:ss'), 'yellow'), color('COMANDO:'), color(`${comando}`), 'DE:', color(pushname), 'EM:', color(groupName))
            if (!cmd && grupo) console.log(color('MENSAGEM RECEBIDA', 'purple'), color('HORA:', 'yellow'), color(moment.tz('America/Sao_Paulo').format('HH:mm:ss'), 'yellow'), 'DE:', color(pushname), 'EM:', color(groupName))
            if (!grupo && !cmd) console.log(color('MENSAGEM RECEBIDA', 'purple'), color('HORA:', 'yellow'), color(moment.tz('America/Sao_Paulo').format('HH:mm:ss'), 'yellow'), 'DE:', color(pushname))

            switch (comando) {

                case 'ping':
                    gusta.sendMessage(from, { text: 'pau no teucu' })
                    break

            }


        } catch (err) {
            console.log(err)
        }
    })

}
start()






