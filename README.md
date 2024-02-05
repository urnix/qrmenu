# Installation

```
pnpm i -g node-static
cd api && pnpm i
```

# Backup data from production

```rsync -avz -e "ssh -i /Users/fen1x/.ssh/aws-ec2-kaypair1.pem" ubuntu@artme.dev:/home/ubuntu/src/menu/data/ /Users/fen1x/dev/my/menu/api/data_prod/```

# Restore data to production

```rsync -avz -e "ssh -i /Users/fen1x/.ssh/aws-ec2-kaypair1.pem" /Users/fen1x/dev/my/menu/api/data_prod/ ubuntu@artme.dev:/home/ubuntu/src/menu/data/```
