const { Client } = require('pg')
const { Kafka } = require('kafkajs')

const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: "postgres"
})


async function connect_db() {
    await client.connect()
    const res = await client.query('SELECT $1::text as message', ['postgres product consumer connected!'])
    console.log(res.rows[0].message) // postgres connected!
}

const kafka = new Kafka({
    clientId: 'product-app',
    brokers: ['broker:29092'],
})

const producer = kafka.producer()
const consumer = kafka.consumer({ groupId: 'product-group' });

async function init() {
    await connect_db();
    await consumer.connect();
    await producer.connect();
    await consumer.subscribe({ topic: 'orders', fromBeginning: true });
   
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const event = JSON.parse(message.value.toString());
            let results = [];
            if (event.type == 'ORDER_CREATED') {
                // this need validation and transaction
                for (const product of event.payload.products) {
                    const result = await client.query("UPDATE public.products SET qty= (qty-$1) where products.id=$2 AND qty > 0", [product.qty, product.product_id]);
                    console.log(result);
                    results.push({
                        product_id: product.product_id,
                        provided_qty: product.qty,
                    })
                }
                // publish product ProductCreated 
                let payload = Buffer.from(JSON.stringify({
                    type: "PRODUCT_QTY_REQUEST",
                    payload: {
                        orderId: event.payload.orderId,
                        products: results
                    }
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
            }
        },
    });
}

init();