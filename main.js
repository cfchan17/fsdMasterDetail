const { query } = require('express')
const express = require('express')
const handlebars = require('express-handlebars')
const mysql = require('mysql2/promise')

const PORT = parseInt(process.env.PORT) || 3000

const app = express()

app.engine('hbs', handlebars({defaultLayout: 'default.hbs'}))
app.set('view engine', 'hbs')

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'db4free.net',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'leisurecf',
    connectionLimit: 4,
    timezone: '+08:00'
})

const SQL_GET_DISTINCT_GENRES = 'select distinct(genre) from genres;'
const SQL_GET_TVID_BY_GENRE = 'select tvid from genres where genre=?;'
const SQL_GET_TV_SHOW_NAMES = 'select tvid, name from tv_shows where tvid in (?) order by name desc limit 20;'
const SQL_GET_TV_SHOW_DETAIL = 'select * from tv_shows where tvid = ?;'

const makeQuery = (sqlQuery, pool) => {
    const f = async (param) => {
        const conn = await pool.getConnection()
        if(param) {
            try{
                const result = await conn.query(sqlQuery, param)
                return result[0]
            }
            catch(e) {
                return Promise.reject(e)
            }
            finally {
                conn.release()
            }
        }
        else {
            try{
                const result = await conn.query(sqlQuery)
                return result[0]
            }
            catch(e) {
                return Promise.reject(e)
            }
            finally {
                conn.release()
            }
        }
    }
    return f
}

const getDistinctGenres = makeQuery(SQL_GET_DISTINCT_GENRES, pool)

//Application
app.get(['/', '/index.html'], async (req, resp) => {
    try {
        const result = await getDistinctGenres()
        const genres = result.map(v => v.genre)

        resp.status(200)
        resp.type('text/html')
        resp.render('index', {
            genres
        })
    }
    catch(e) {
        console.error('DB Error: %s', e)
        resp.status(500)
        resp.type('text/html')
        resp.send('<h3>DB Error</h3>')
    }
})

app.get('/getTVShows', async (req, resp) => {
    const genreSelected = req.query.genre
    const conn = await pool.getConnection()
    try {
        const result = await conn.query(SQL_GET_TVID_BY_GENRE, `${genreSelected}`)
        const tvids = result[0].map(v => v.tvid)
        const result2 = await conn.query(SQL_GET_TV_SHOW_NAMES, [tvids])
        const tvshows = result2[0].map(v => {
            v.tvid = genreSelected + '-' + v.tvid
            return v
        })
        conn.release()

        resp.status(200)
        resp.type('text/html')
        resp.render('tvshows', {
            tvshows
        })
    }
    catch(e) {
        console.info(this.sql)
        console.error('DB Error: %s', e)
        resp.status(500)
        resp.type('text/html')
        resp.send('<h3>DB Error</h3>')
    }
    finally {
        conn.release()
    }
})

app.get('/getDetail/:id', async (req, resp) => {
    const [genre, tvid] = req.params.id.split('-')
    const conn = await pool.getConnection()
    try {
        const result = await conn.query(SQL_GET_TV_SHOW_DETAIL, tvid)
        const tvshow = result[0]
        conn.release()
        
        resp.status(200)
        resp.type('text/html')
        resp.render('showDetail', {
            tvshow,
            genre
        })
    }
    catch(e) {
        console.error('DB Error: %s', e)
        resp.status(500)
        resp.type('text/html')
        resp.send('<h3>DB Error</h3>')
    }
    finally {
        conn.release()
    }
})

//Start the app
pool.getConnection()
    .then(conn => {
        const p0 = Promise.resolve(conn)
        const p1 = conn.ping()
        return Promise.all([p0, p1])
    })
    .then(result => {
        const conn = result[0]
        conn.release()
        app.listen(PORT, () => {
            console.info(`App has started on port ${PORT} at ${new Date()}`)
        })
    })
    .catch(e => {
        console.error('DB Error: %s', e)
    })