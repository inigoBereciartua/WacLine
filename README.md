# WebAnnotatorSPL
> Please note that this is a prototype under development. It is not thought to use in a production environment yet.

WebAnnotatorSPL is a Software Product Line to manage heterogeneity in Web Annotation domain. Specifically, WebAnnotatorSPL allows to configure and automatically generate customized web annotation clients to conduct annotation activities in specific domains.
Created annotation clients are [browser extensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions) currently compatible with Chromium-like web browsers (Google Chrome, Opera,...).

# Requirements for contributors and annotation clients developers
* Pure::variants v4.0: Our SPL is build on top of [pure::variants](https://www.pure-systems.com/). Pure::variants is an eclipse plugin for development and deployment of products lines and software families.
  * [Evaluation Software](https://www.pure-systems.com/downloads-6.html) to develop it. 
* NodeJS v10 (planned an update to v12): required to compile the resultant generated products. You can use [nvm](https://github.com/nvm-sh/nvm) to manage multiple installations of nodeJS.

# How to create and test your annotation client
> You can follow [this small video](https://go.haritzmedina.com/waclineVideo) that creates a sample extension 

Step 1. You can create a product variant in ./Variants/ folder in Eclipse. Configure with the features that your annotation client must have to conduct your annotation activity. You can view the full documentation of the feature model [here](https://onekin.github.io/WebAnnotatorSPL/).

Step 2. Generate the product, the resultant will be placed in ./output/<name_of_your_product>

Step 3. Resolve dependencies and compile:
* In windows systems: Open a powershell and execute in `./output/<name_of_your_product>` folder:
`./dependencies.ps1`
* In UNIX-like systems: Open a shell and execute in `./output/<name_of_your_product>` folder:
`./dependencies.sh`

Step 4. A compiled browser extension is created in `./output/<name_of_your_product>/dist` folder. Drag and drop to your browser's [extensions folder](chrome://extensions/) (remember that Developer mode must be activated)

Step 5. Test the installed extension in the browser

# Examples
We have created three variants that can be used as an example:
* HighlightAndGo
* ReviewAndGo
* MarkAndGo

