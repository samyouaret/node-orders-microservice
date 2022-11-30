const express = require("express");
const { Client } = require('pg')
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
})

async function connect() {
    await client.connect()
    const res = await client.query('SELECT $1::text as message', ['Hello world!'])
    console.log(res.rows[0].message) // Hello world!
    await client.end()
}

const PORT = process.env.APP_PORT

app.get("/orders", (req, res) => {
    res.setHeader("Content-Type", 'application/json')
    res.json({
        orders: [
            {
                id: 1,
                products: [
                    {
                        id: "1",
                        name: "Ebook"
                    }
                ]
            },
            {
                id: 2,
                products: [
                    {
                        id: "2",
                        name: "Course"
                    }
                ]
            }
        ]
    })
})

connect()
app.listen(PORT, () => console.log(`App on port: ${PORT}`))