fetch_model:
	bash ./scripts/fetch_model.sh
set_up: 
	bash ./scripts/install_ngrok.sh
authtoken: 
	bash ./scripts/authtoken_ngrok.sh
deploy: 
	bash ./scripts/publib_with_ngrok.sh
run: 
	docker run -it --rm -p 5000:5000 --name colorize_deploy colorize bash -c "python model_api.py & make deploy"