const Pool = require('pg-pool');

const pool = new Pool({
  user: 'stephen',
  database: 'reviews',
  port: 5432,
});

const getReviewList = (request, response) => {
  const { productId } = request.params;
  pool.query(`SELECT * FROM reviews 
              LEFT JOIN photos 
              ON photos.review_id = reviews.id 
              WHERE reviews.product_id = ${productId}`, (error, results) => {
    if (error) {
      throw error;
    }
    const reviews = {};
    results.rows.forEach((row) => {
      if (!reviews[row.id]) {
        reviews[row.id] = {
          review_id: row.id,
          rating: row.rating,
          summary: row.summary,
          response: row.response,
          body: row.body,
          date: row.date,
          reviewer_name: row.reviewer_name,
          helpfulness: row.helpfulness,
          photos: [],
        };
      }
      if (row.photo_id) {
        reviews[row.id].photos.push(
          {
            url: row.link,
            id: row.photo_id,
          },
        );
      }
    });
    const output = {
      product: productId,
      page: 0,
      count: Object.keys(reviews).length,
      results: Object.values(reviews),
    };
    response.status(200).json(output);
  });
};

const getMetaData = (request, response) => {
  const { productId } = request.params;
  pool.query(`SELECT
              reviews.recommend,
              reviews.rating,
              characteristics_reviews.id, 
              characteristics_reviews.review_id, 
              characteristics_reviews.characteristic_rating,
              characteristics.characteristic 
              FROM characteristics_reviews
              LEFT JOIN reviews ON reviews.id = characteristics_reviews.review_id 
              LEFT JOIN characteristics ON characteristics_reviews.characteristic_id = characteristics.id 
              WHERE reviews.product_id = ${productId}`,
  (error, results) => {
    if (error) {
      throw error;
    }
    const metaData = {
      productId,
      ratings: {},
      recommended: {
        0: 0,
        1: 0,
      },
      characteristics: {},
    };
    results.rows.forEach((row) => {
      if (!metaData.ratings[row.rating]) {
        metaData.ratings[row.rating] = 1;
      } else {
        metaData.ratings[row.rating] += 1;
      }
      if (row.recommend) { metaData.recommended[0] += 1; }
      if (!row.recommend) { metaData.recommended[1] += 1; }
      if (!metaData.characteristics[row.characteristic]) {
        metaData.characteristics[row.characteristic] = {
          id: row.id,
          rating: row.characteristic_rating,
          ratingCount: 1,
        };
      } else {
        metaData.characteristics[row.characteristic].ratingCount += 1;
        metaData.characteristics[row.characteristic].rating = Math.floor(
          (metaData.characteristics[row.characteristic].rating + row.characteristic_rating)
          / metaData.characteristics[row.characteristic].ratingCount,
        );
      }
    });
    response.status(202).json(metaData);
  });
};

const markAsHelpful = (request, response) => {
  const { review_id } = request.params;
  pool.query(`UPDATE reviews
                SET helpfulness = helpfulness + 1
                WHERE reviews.id = ${review_id}`,
  (error) => {
    if (error) {
      throw error;
    }
    response.sendStatus(201);
  });
};

const markAsReported = (request, response) => {
  const { review_id } = request.params;
  pool.query(`UPDATE reviews
                SET reported = true
                WHERE reviews.id = ${review_id}`,
  (error) => {
    if (error) {
      throw error;
    }
    response.sendStatus(201);
  });
};

const postReview = (req, response) => {
  const { product_id } = req.params;
  const date = new Date().toString();
  let reviewId;
  pool.query(`INSERT INTO reviews
              (id, product_id, rating, date_submitted, summary, body, recommend, reported, reviewer_name, reviewer_email, response, helpfulness) 
              VALUES 
              (default, ${product_id}, ${req.body.rating}, '${date}', '${req.body.summary}', '${req.body.body}', '${req.body.recommend}', false, '${req.body.name}', '${req.body.email}', null, 0)
              RETURNING id;`)
    .then((returned) => {
      const { id } = returned.rows[0];
      reviewId = id;
      Object.entries(JSON.parse(req.body.characteristics)).forEach((entry) => {
        pool.query(`INSERT INTO characteristics_reviews
                  (id, review_id, characteristic_id, characteristic_rating)
                  VALUES
                  (default, ${id}, ${entry[0]}, ${entry[1]})`);
      });
    })
    .then(() => {
      JSON.parse(req.body.photos).forEach((url) => {
        pool.query(`INSERT INTO photos 
                    (photo_id, review_id, link)
                    VALUES 
                    (default, ${reviewId}, '${url}')`);
      });
    })
    .then(() => response.sendStatus(202));
};

module.exports = {
  getReviewList,
  getMetaData,
  markAsHelpful,
  markAsReported,
  postReview,
};
