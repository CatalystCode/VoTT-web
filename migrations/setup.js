require('dotenv').config();

const pg = require('pg');
const format = require('pg-format');
const config = {
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000
}
const pool = new pg.Pool(config);

pool.connect(function (err, client, done){
  if (err) { console.log(err); }
  let myclient = client;
  const accessrightQuery = 'CREATE TABLE IF NOT EXISTS "public"."accessright" ("id" text NOT NULL, "role" text, "user" text, "project" text, "createdAt" timestamp(6) WITH TIME ZONE, "updatedAt" timestamp(6) WITH TIME ZONE) WITH (OIDS=FALSE); ALTER TABLE "public"."accessright" DROP CONSTRAINT IF EXISTS "accessright_pkey"; ALTER TABLE "public"."accessright" ADD CONSTRAINT "accessright_pkey" PRIMARY KEY ("id") NOT DEFERRABLE INITIALLY IMMEDIATE;' ;
  const inviteQuery = 'CREATE TABLE IF NOT EXISTS "public"."invite" ("id" text NOT NULL, "user" text, "project" text, "createdAt" timestamp(6) WITH TIME ZONE, "updatedAt" timestamp(6) WITH TIME ZONE) WITH (OIDS=FALSE); ALTER TABLE "public"."invite" DROP CONSTRAINT IF EXISTS "invite_pkey"; ALTER TABLE "public"."invite" ADD CONSTRAINT "invite_pkey" PRIMARY KEY ("id") NOT DEFERRABLE INITIALLY IMMEDIATE;' ;
  const projectQuery = 'CREATE TABLE IF NOT EXISTS "public"."project" ("id" text NOT NULL, "name" text, "type" text, "labels" json, "instructionsText" text, "instructionsImageId" text, "createdAt" timestamp(6) WITH TIME ZONE, "updatedAt" timestamp(6) WITH TIME ZONE) WITH (OIDS=FALSE); ALTER TABLE "public"."project" DROP CONSTRAINT IF EXISTS "project_pkey"; ALTER TABLE "public"."project" ADD CONSTRAINT "project_pkey" PRIMARY KEY ("id") NOT DEFERRABLE INITIALLY IMMEDIATE;' ;
  const trainingimageQuery = 'CREATE TABLE IF NOT EXISTS "public"."trainingimage" ("id" text NOT NULL, "name" text, "status" text, "tags" json, "project" text, "createdAt" timestamp(6) WITH TIME ZONE, "updatedAt" timestamp(6) WITH TIME ZONE) WITH (OIDS=FALSE); ALTER TABLE "public"."trainingimage" DROP CONSTRAINT IF EXISTS "trainingimage_pkey"; ALTER TABLE "public"."trainingimage" ADD CONSTRAINT "trainingimage_pkey" PRIMARY KEY ("id") NOT DEFERRABLE INITIALLY IMMEDIATE;' ;
  const trainingimagetagcontributionQuery = 'CREATE TABLE IF NOT EXISTS "public"."trainingimagetagcontribution" ("id" text NOT NULL, "tags" json, "image" text, "user" text, "createdAt" timestamp(6) WITH TIME ZONE, "updatedAt" timestamp(6) WITH TIME ZONE) WITH (OIDS=FALSE); ALTER TABLE "public"."trainingimagetagcontribution" DROP CONSTRAINT IF EXISTS "trainingimagetagcontribution_pkey"; ALTER TABLE "public"."trainingimagetagcontribution" ADD CONSTRAINT "trainingimagetagcontribution_pkey" PRIMARY KEY ("id") NOT DEFERRABLE INITIALLY IMMEDIATE;' ;
  const trainingrequestQuery = 'CREATE TABLE IF NOT EXISTS "public"."trainingrequest" ("id" text NOT NULL, "status" text, "project" text, "requestedBy" text, "createdAt" timestamp(6) WITH TIME ZONE, "updatedAt" timestamp(6) WITH TIME ZONE) WITH (OIDS=FALSE); ALTER TABLE "public"."trainingrequest" DROP CONSTRAINT IF EXISTS "trainingrequest_pkey"; ALTER TABLE "public"."trainingrequest" ADD CONSTRAINT "trainingrequest_pkey" PRIMARY KEY ("id") NOT DEFERRABLE INITIALLY IMMEDIATE;';
  const userQuery = 'CREATE TABLE IF NOT EXISTS "public"."user" ("id" text NOT NULL, "name" text, "email" text, "createdAt" timestamp(6) WITH TIME ZONE, "updatedAt" timestamp(6) WITH TIME ZONE) WITH (OIDS=FALSE); ALTER TABLE "public"."user" DROP CONSTRAINT IF EXISTS "user_pkey"; ALTER TABLE "public"."user" ADD CONSTRAINT "user_pkey" PRIMARY KEY ("id") NOT DEFERRABLE INITIALLY IMMEDIATE; '

  let combinedQuery = format(accessrightQuery + inviteQuery + projectQuery + trainingimageQuery + trainingimagetagcontributionQuery + trainingrequestQuery + userQuery);

  myclient.query(combinedQuery, function(err, res){
    if (err) { console.log(err); }
    else { console.log( `Table created.` ); }
    
  })
});