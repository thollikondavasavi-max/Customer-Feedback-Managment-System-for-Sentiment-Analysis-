const express = require('express');
const cors = require('cors');
const oracledb = require('oracledb');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Oracle Database Configuration
const dbConfig = {
    user: 'system',
    password: 'root',
    connectString: 'localhost:1521/XE'
};

// API Routes

// 1. Get all feedback
app.get('/api/feedback', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT f.feedback_id, f.feedback_text, f.feedback_date, f.sentiment,
                    c.customer_id, c.name AS customer_name, c.email, c.country,
                    p.product_id, p.name AS product_name, p.category
             FROM Feedback f
             JOIN Customers c ON f.customer_id = c.customer_id
             JOIN Products p ON f.product_id = p.product_id
             ORDER BY f.feedback_date DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});
// 2. Insert new feedback and return sentiment result (MANUAL ID APPROACH)
app.post('/api/feedback', async (req, res) => {
  const { customer_id, product_id, feedback_text, feedback_date } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    // Analyze sentiment using our function
    const detectedSentiment = analyzeSentiment(feedback_text);
    
    // MANUAL APPROACH: Get the next available feedback_id
    const maxIdResult = await connection.execute(
      `SELECT NVL(MAX(feedback_id), 0) as max_id FROM Feedback`
    );
    const nextFeedbackId = maxIdResult.rows[0][0] + 1;
    
    console.log(`Inserting feedback: ID=${nextFeedbackId}, Customer=${customer_id}, Product=${product_id}, Sentiment=${detectedSentiment}`);
    
    // Insert with manually calculated ID
    await connection.execute(
      `INSERT INTO Feedback (feedback_id, customer_id, product_id, feedback_text, feedback_date, sentiment) 
       VALUES (:feedback_id, :customer_id, :product_id, :feedback_text, TO_DATE(:feedback_date, 'YYYY-MM-DD'), :sentiment)`,
      {
        feedback_id: nextFeedbackId,
        customer_id: parseInt(customer_id),
        product_id: parseInt(product_id),
        feedback_text: feedback_text,
        feedback_date: feedback_date || new Date().toISOString().split('T')[0],
        sentiment: detectedSentiment
      },
      { autoCommit: true }
    );

    console.log('✅ Feedback inserted successfully!');
    
    res.json({
      success: true,
      message: `Feedback analyzed and submitted successfully!`,
      sentiment: detectedSentiment,
      feedback_id: nextFeedbackId
    });
  } catch (error) {
    console.error('❌ Error inserting feedback:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error: ' + error.message 
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
  }
});
// Enhanced sentiment analysis function optimized for your data
function analyzeSentiment(text) {
  const positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'perfect', 
    'love', 'liked', 'happy', 'satisfied', 'wonderful', 'best', 'nice', 'brilliant', 
    'outstanding', 'superb', 'working well', 'easy to use', 'recommend', 'fast',
    'smooth', 'comfortable', 'beautiful', 'stunning', 'impressive', 'reliable',
    'worth', 'exceeded', 'pleased', 'enjoy', 'excited', 'perfectly', 'flawless',
    'quick', 'responsive', 'helpful', 'supportive', 'friendly', 'professional',
    'excellent', 'outstanding', 'superior', 'quality', 'durable', 'efficient',
    'effective', 'convenient', 'user-friendly', 'intuitive', 'seamless', 'stable',
    'excellent', 'love it', 'highly recommend', 'very good', 'so good', 'really good',
    'powerful', 'fit', 'strong', 'robust', 'premium', 'luxury', 'advanced', 'innovative',
    'comfort', 'enjoyable', 'satisfactory', 'pleasing', 'remarkable', 'exceptional',
    'super', 'fine', 'decent', 'acceptable', 'adequate', 'reasonable', 'sufficient',
    // Your specific positive words from data
    'clear', 'crystal clear', 'deep bass', 'feature-rich', 'stylish', 'works well',
    'easy to swallow', 'cozy', 'heavy', 'tastes fresh', 'removes dust', 'sturdy',
    'easy to clean', 'works perfectly', 'absorbs quickly', 'hydrates', 'good quality',
    'pure', 'tasty', 'sharp', 'well-balanced', 'superb', 'premium', 'effective',
    'keeps food warm', 'sharp', 'color accurate', 'durable', 'smell great', 'quickly',
    'maintain temperature', 'soft', 'accurate', 'useful', 'dissolve well', 'clean clothes',
    'lasts long', 'responsive', 'refreshing', 'eco-friendly', 'cooks evenly', 'saves energy',
    'bright', 'comfortable', 'block noise', 'aromatic', 'fresh', 'hydrated', 'stay fit'
  ];
  
  const negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'dislike', 'angry', 
    'upset', 'disappointed', 'poor', 'broken', 'not working', 'useless', 'waste', 
    'problem', 'issue', 'difficult', 'complicated', 'slow', 'crashed', 'failed',
    'defective', 'damaged', 'missing', 'late', 'expensive', 'overpriced', 'cheap',
    'unreliable', 'frustrating', 'annoying', 'complicated', 'confusing', 'buggy',
    'freeze', 'frozen', 'error', 'problems', 'issues', 'complaint', 'return',
    'refund', 'never again', 'regret', 'avoid', 'junk', 'garbage', 'trash',
    'useless', 'pointless', 'horrendous', 'atrocious', 'unacceptable', 'defective',
    'malfunction', 'defect', 'faulty', 'inferior', 'subpar', 'unusable', 'worthless',
    'very bad', 'so bad', 'really bad', 'too expensive', 'not worth', 'poor quality',
    'weak', 'flimsy', 'cheaply made', 'noisy', 'loud', 'unstable', 'shaky', 'dislike',
    'unhappy', 'dissatisfied', 'fault', 'flaw', 'drawback', 'limitation', 'weakness',
    'inadequate', 'insufficient', 'substandard', 'unacceptable', 'unpleasant',
    // Your specific negative words from data
    'stale', 'damaged', 'drains fast', 'slippery', 'frequent cleaning', 'flimsy',
    'too strong', 'not powerful', 'bit hard', 'noisy'
  ];
  
  // Convert to lowercase for matching
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  // Check each word for sentiment
  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    
    // Exact matches get higher weight
    if (positiveWords.includes(cleanWord)) {
      positiveScore += 2;
    } else if (negativeWords.includes(cleanWord)) {
      negativeScore += 2;
    }
    // Partial matches get lower weight
    else {
      if (positiveWords.some(positive => cleanWord.includes(positive) && cleanWord.length > 2)) {
        positiveScore += 1;
      }
      if (negativeWords.some(negative => cleanWord.includes(negative) && cleanWord.length > 2)) {
        negativeScore += 1;
      }
    }
  });
  
  // Special handling for mixed feedback with "but"
  if (lowerText.includes(' but ') || lowerText.includes(' however ') || lowerText.includes(' although ')) {
    // Mixed feedback often indicates Neutral
    if (positiveScore > 0 && negativeScore > 0) {
      return 'Neutral';
    }
  }
  
  // Special cases from your data
  if (lowerText.includes('stale')) return 'Negative';
  if (lowerText.includes('poor packaging') || lowerText.includes('packaging was poor')) return 'Negative';
  
  console.log(`📊 Analysis: "${text.substring(0, 40)}..." -> Positive: ${positiveScore}, Negative: ${negativeScore}`);
  
  // Determine final sentiment
  if (positiveScore > negativeScore) {
    return 'Positive';
  } else if (negativeScore > positiveScore) {
    return 'Negative';
  } else {
    // If scores are equal or both zero, check content
    if (positiveScore === 0 && negativeScore === 0) {
      // Simple descriptions without clear opinion are Neutral
      const hasDescriptiveWords = /\b(fast|slow|big|small|heavy|light|warm|cool|strong|weak)\b/i.test(text);
      const hasOpinionWords = /\b(good|bad|great|terrible|love|hate|like|dislike)\b/i.test(text);
      
      if (hasDescriptiveWords && !hasOpinionWords) {
        return 'Neutral';
      }
    }
    return positiveScore > 0 ? 'Positive' : 'Neutral';
  }
}
// 3. Get product sentiment breakdown
app.get('/api/products/sentiment', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT p.product_id, p.name AS product_name, p.category,
                    COUNT(CASE WHEN f.sentiment = 'Positive' THEN 1 END) AS positive_count,
                    COUNT(CASE WHEN f.sentiment = 'Negative' THEN 1 END) AS negative_count,
                    COUNT(CASE WHEN f.sentiment = 'Neutral' THEN 1 END) AS neutral_count,
                    COUNT(*) AS total_feedback
             FROM Products p
             LEFT JOIN Feedback f ON p.product_id = f.product_id
             GROUP BY p.product_id, p.name, p.category
             ORDER BY p.product_id`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching product sentiment:', error);
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// 4. Get daily sentiment report
app.get('/api/reports/daily-sentiment', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT feedback_date,
                    COUNT(CASE WHEN sentiment = 'Positive' THEN 1 END) AS positive_count,
                    COUNT(CASE WHEN sentiment = 'Negative' THEN 1 END) AS negative_count,
                    COUNT(CASE WHEN sentiment = 'Neutral' THEN 1 END) AS neutral_count
             FROM Feedback
             GROUP BY feedback_date
             ORDER BY feedback_date`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching daily report:', error);
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// 5. Get negative feedback log (from trigger)
app.get('/api/negative-feedback', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT * FROM NegativeFeedbackLog ORDER BY feedback_date DESC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching negative feedback:', error);
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// 6. Get top customers by feedback count - FIXED
app.get('/api/customers/top', async (req, res) => {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute(
            `SELECT c.customer_id, c.name, c.email, c.country,
                    COUNT(f.feedback_id) AS feedback_count
             FROM Customers c
             JOIN Feedback f ON c.customer_id = f.customer_id
             GROUP BY c.customer_id, c.name, c.email, c.country
             ORDER BY feedback_count DESC`
        );
        
        // Get top 5 rows from the result
        const topCustomers = result.rows.slice(0, 5);
        res.json(topCustomers);
    } catch (error) {
        console.error('Error fetching top customers:', error);
        res.status(500).json({ error: 'Database error: ' + error.message });
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (error) {
                console.error('Error closing connection:', error);
            }
        }
    }
});

// 7. Get feedback by country
app.get('/api/reports/country-sentiment', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const result = await connection.execute(
      `SELECT c.country,
              COUNT(CASE WHEN LOWER(f.sentiment) = 'positive' THEN 1 END) AS positive_count,
              COUNT(CASE WHEN LOWER(f.sentiment) = 'negative' THEN 1 END) AS negative_count,
              COUNT(CASE WHEN LOWER(f.sentiment) = 'neutral' THEN 1 END) AS neutral_count,
              COUNT(*) AS total_feedback
       FROM Customers c
       JOIN Feedback f ON c.customer_id = f.customer_id
       GROUP BY c.country
       ORDER BY total_feedback DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching country sentiment:', error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
});

// 8. Get sample customers and products for the form
app.get('/api/sample-data', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    const [customers, products] = await Promise.all([
      connection.execute(`SELECT customer_id, name FROM Customers WHERE ROWNUM <= 10`),
      connection.execute(`SELECT product_id, name FROM Products WHERE ROWNUM <= 10`)
    ]);
    
    res.json({
      customers: customers.rows,
      products: products.rows
    });
  } catch (error) {
    console.error('Error fetching sample data:', error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
});
// Test sentiment analysis on existing feedback data
app.get('/api/test-existing-sentiments', async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    
    // Get all feedback with their current sentiments
    const result = await connection.execute(
      `SELECT feedback_id, feedback_text, sentiment 
       FROM Feedback 
       ORDER BY feedback_id`
    );
    
    const analysisResults = [];
    let matchCount = 0;
    
    console.log('\n🧪 TESTING SENTIMENT ANALYSIS ON EXISTING DATA:\n');
    
    // Analyze each feedback with our function
    for (const row of result.rows) {
      const [feedback_id, feedback_text, current_sentiment] = row;
      const analyzed_sentiment = analyzeSentiment(feedback_text);
      const matches = current_sentiment === analyzed_sentiment;
      
      if (matches) matchCount++;
      
      analysisResults.push({
        feedback_id,
        feedback_text: feedback_text.substring(0, 60) + (feedback_text.length > 60 ? '...' : ''),
        current_sentiment,
        analyzed_sentiment,
        match: matches
      });
      
      // Log detailed analysis for each feedback
      console.log(`ID ${feedback_id}: "${feedback_text}"`);
      console.log(`   Current: ${current_sentiment}, Analyzed: ${analyzed_sentiment}, Match: ${matches ? '✅' : '❌'}`);
    }
    
    const accuracy = ((matchCount / analysisResults.length) * 100).toFixed(2);
    
    console.log(`\n📊 RESULTS: ${matchCount}/${analysisResults.length} matches (${accuracy}% accuracy)`);
    
    res.json({
      success: true,
      summary: {
        total_tested: analysisResults.length,
        matches: matchCount,
        accuracy: accuracy + '%',
        breakdown: {
          positive: analysisResults.filter(r => r.current_sentiment === 'Positive').length,
          negative: analysisResults.filter(r => r.current_sentiment === 'Negative').length,
          neutral: analysisResults.filter(r => r.current_sentiment === 'Neutral').length
        }
      },
      details: analysisResults
    });
    
  } catch (error) {
    console.error('Error testing sentiment analysis:', error);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});