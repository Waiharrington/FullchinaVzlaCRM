const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'whatsapp-web.js',
  'src',
  'util',
  'Injected',
  'Utils.js',
)

const broken = `cannotBeRanked: window
                        .require('WAWebStatusGatingUtils')
                        .canCheckStatusRankingPosterGating(),`
const fixed = `cannotBeRanked: (() => {
                        const gating = window.require('WAWebStatusGatingUtils')
                            .canCheckStatusRankingPosterGating;
                        return typeof gating === 'function' ? gating() : false;
                    })(),`

if (!fs.existsSync(target)) {
  throw new Error(`No se encontró el archivo esperado de whatsapp-web.js: ${target}`)
}

const source = fs.readFileSync(target, 'utf8')
if (source.includes(fixed)) {
  console.log('Compatibilidad de WhatsApp Web ya aplicada.')
} else if (source.includes(broken)) {
  fs.writeFileSync(target, source.replace(broken, fixed))
  console.log('Compatibilidad aplicada: helper de ranking ausente protegido.')
} else {
  throw new Error('La fuente de whatsapp-web.js cambió; no se aplicó un parche ambiguo.')
}
