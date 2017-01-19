# curl -XPUT 'localhost:9200/.kibana_gcs4?pretty' -d'
# {
#   "mappings": {
#     "search": {
#       "properties": {
#         "title": {
#           "type": "string",
#           "index": "not_analyzed"
#         }
#       }
#     }
#   }
# }'

# curl -XPUT 'localhost:9200/.kibana_gcs4/_mapping/dashboard?pretty' -d'
# {
#   "properties": {
#     "title": {
#       "type": "string",
#       "index": "not_analyzed"
#     }
#   }
# }'


# curl -XPUT 'localhost:9200/.kibana_gcs4/_mapping/visualization?pretty' -d'
# {
#   "properties": {
#     "title": {
#       "type": "string",
#       "index": "not_analyzed"
#     },
#     "savedSearchId": {
#       "type": "string",
#       "index": "not_analyzed"
#     }
#   }
# }'

# curl -XPOST 'localhost:9200/_reindex?pretty' -d'
# {
#   "source": {
#     "index": ".kibana"
#   },
#   "dest": {
#     "index": ".kibana_gcs4"
#   }
# }'

# ../node_modules/elasticdump/bin/elasticdump \
#   --input=http://localhost:9200/.kibana_gcs4 \
#   --output=http://localhost:9200/.kibana_gcs5 \
#   --type=analyzer
# ../node_modules/elasticdump/bin/elasticdump \
#   --input=http://localhost:9200/.kibana_gcs4 \
#   --output=http://localhost:9200/.kibana_gcs5 \
#   --type=mapping

# curl -XPOST 'localhost:9200/_reindex?pretty' -d'
# {
#   "source": {
#     "index": ".kibana_gcs4"
#   },
#   "dest": {
#     "index": ".kibana_gcs5"
#   }
# }'

curl -XDELETE localhost:9200/.kibana

../node_modules/elasticdump/bin/elasticdump \
  --input=http://localhost:9200/.kibana_gcs5 \
  --output=http://localhost:9200/.kibana \
  --type=analyzer
../node_modules/elasticdump/bin/elasticdump \
  --input=http://localhost:9200/.kibana_gcs5 \
  --output=http://localhost:9200/.kibana \
  --type=mapping

curl -XPOST 'localhost:9200/_reindex?pretty' -d'
{
  "source": {
    "index": ".kibana_gcs5"
  },
  "dest": {
    "index": ".kibana"
  }
}'


