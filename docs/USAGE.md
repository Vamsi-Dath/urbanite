# Usage

## Table of contents
1. [Installation](#installation)
  1. [Installing via Docker](#installing-via-docker)
  2. [Installing manually](#installing-manually)
3. [Quick start](#quick-start)

## Installation


Begin by cloning Urbanite's repository:

```console
git clone git@github.com:urban-toolkit/urbanite.git
```

Urbanite is divided into three components: backend (provenance and database management), Python sandbox (to run Python code), and the frontend. All components need to be running.

Urbanite was tested on Windows 11 and MacOS Sonoma 14.5. **Python >= 3.9 & < 3.12 is needed.**

It is recommended to install its requirements on a virtual environment such as [Anaconda](https://anaconda.org):

 ```console
conda create -n urbanite python=3.10
conda activate urbanite
```

You can install Urbanite using Docker, which will handle the orchestration of all required servers automatically, or install each component manually for more control and customization.

Urbanite's current version uses ChatGPT. You need to add your OpenAI API key to the file `backend/api.env`. Check [here](https://platform.openai.com/api-keys) to get an OpenAI API key.

### Installing via Docker

Docker is the easiest way to get Urbanite up and running. It handles the orchestration of all necessary components: the backend, sandbox, and frontend.

Prerequisites:
- [Docker](https://docs.docker.com/get-started/get-docker/)

After cloning the repository and initializing submodules (see above), run the full Urbanite stack with:

```console
docker compose up --build
```

For older Docker versions, the following command may be required instead:
```console
docker-compose up --build
```

This will build and start all required services: the backend, Python sandbox, and frontend. Urbanite's frontend will be available at http://localhost:8080.

⚠️ **Note:** The initial build may take a few minutes depending on your machine and network speed, as it installs dependencies and compiles assets.

### Installing manually


#### 1. Urbanite Backend

The backend source code is available on the `backend` folder. Inside the `backend` folder:

```console
pip install -r requirements.txt
```

Once the requirements are installed, we have to create a SQLite database for provenance.

```console
python create_provenance_db.py
```

Now the backend server can be started.

```console
python server.py
```

The backend is also responsible for user authentication. In order to use Urbanite's functionalities, you will need authentication. To do so, upgrade the database by applying migrations (see below for steps).

##### Apply migrations

You need to run this command before you start using Urbanite:

```console
# Run this to apply any pending migrations.
FLASK_APP=server.py flask db upgrade
```

If the environment variable FLASK_APP does not work with the command above, set the environnment variable in your terminal.

##### Create migration

```console
# after updating any model, run this to generate a new migration
FLASK_APP=server.py flask db migrate -m "Migration Name"
```


#### 2. Python sandbox

Since modules on Urbanite can run Python code, it is necessary to run a Python sandbox inside the `sandbox` folder.

**To run without Docker (Anaconda environment recommended):**

```console
pip install -r requirements.txt
```

Install UTK's backend module to have access to the sandbox:

```console
pip install utk-0.8.9.tar.gz
```

Run the server:

```console
python server.py
```

**If you prefer to use Docker (but you won't be able to use GPU for Ray Tracing), inside the `sandbox` folder:**

```console
docker-compose up
```

#### 3. Urbanite Frontend

Because Urbanite also uses UTK's frontend, it is necessary to compile the UTK submodule. In the `utk-workflow/src/utk-ts` folder:

```console
conda install nodejs=22.13.0
npm install
npm run build 
```

To start Urbanite's frontend, simply run:

```console
npm install
npm run build
npm run start
```

Note: You must run Urbanite's backend & sandbox while running the frontend.

#### Ray tracing

To use Ray Tracing, please see UTK's [requirements](https://github.com/urban-toolkit/utk).

### Quick start

For a simple introductory example check [this](QUICK-START.md) tutorial. See [here](README.md) for more examples.

![Tutorial](images/final_result.png?raw=true)


