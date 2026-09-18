const axios = require('axios');

async function testSale() {
  try {
    const saleData = {
      idempotency_key: 'sale-test-001',
      payment_method: 'UPI',
      items: [
        {
          product_id: 'prod_1', // Aashirvaad Atta 5kg (Price 250)
          quantity: 2
        },
        {
          product_id: 'prod_2', // Tata Salt 1kg (Price 25)
          quantity: 1
        }
      ]
    };

    console.log('1. Creating Sale...');
    const response = await axios.post('http://localhost:3000/api/billing/sale', saleData);
    
    console.log('Sale Created Successfully!');
    console.log('Sale ID:', response.data.id);
    console.log('Total Amount:', response.data.total_amount);
    
    console.log('\n2. You can view the generated PDF receipt in your browser at:');
    console.log(`http://localhost:3000/api/billing/receipt/${response.data.id}`);

  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testSale();
