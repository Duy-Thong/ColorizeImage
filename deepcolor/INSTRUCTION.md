# How to use docker
- build image:
```bash
    $ cd deepcolor
    $ make image
    # or
    $ docker build --no-cache -t colorize -f Dockerfile.api .
```
- run:
```bash
    $ cd deepcolor
    $ make run
    # or
    $ docker run -it --rm -p 5000:5000 --name colorize_deploy colorize bash -c "python model_api.py | make deploy"
```