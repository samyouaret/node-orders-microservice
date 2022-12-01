const { Kafka } = require('kafkajs')

const kafka = new Kafka({
    clientId: 'orders-app',
    brokers: ['broker:29092'],
})
const consumer = kafka.consumer({ groupId: 'test-group' });

async function init() {
    await consumer.connect();
    await consumer.subscribe({ topic: 'orders', fromBeginning: true });
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            console.log({
                partition,
                offset: message.offset,
                value: message.value.toString(),
            });
        },
    });
}

init();