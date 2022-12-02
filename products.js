const express = require("express");
const { Client } = require('pg')
const { Kafka } = require('kafkajs')
const { Worker } = require('worker_threads');

const kafka = new Kafka({
    clientId: 'products-app',
    brokers: ['broker:29092'],
})
const producer = kafka.producer()

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: "postgres"
})

const status = {
    PENDING: "PENDING",
}

async function connect_db() {
    await client.connect()
    const res = await client.query('SELECT $1::text as message', ['postgres connected!'])
    console.log(res.rows[0].message) // postgres connected!
}

const PORT = process.env.APP_PORT

app.get("/products", async (req, res) => {
    const result = await client.query("SELECT * from public.products");
    res.json(result.rows)
});

app.post("/products", async (req, res) => {
    const result = await client.query("INSERT INTO public.products(name,qty) values($1,$2) RETURNING *", [req.body.name, req.body.qty]);
    const product = result.rows[0];

    // publish product ProductCreated 
    let payload = Buffer.from(JSON.stringify({
        type: "PRODUCT_CREATED",
        payload: product
    }));

    try {
        await producer.send({
            topic: 'products',
            messages: [
                { value: payload },
            ],
        })
    } catch (error) {
        console.error(error);
    }
    res.json(product)
});

app.use((err, req, res) => {
    res.json(err.message);
});

function runConsumer() {
    return new Promise((resolve, reject) => {
        const worker = new Worker('./product-consumer.js');
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
            if (code !== 0)
                reject(new Error(`Worker stopped with exit code ${code}`));
        })
    })
}

async function init() {
    await connect_db()
    await producer.connect()
    app.listen(PORT, () => console.log(`App on port: ${PORT}`))
    await runConsumer();
}

init();