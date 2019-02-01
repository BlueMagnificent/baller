/**
 * Resource Manager
 * 
 */

import series from 'async-es/series';


class ResourceCache {
    constructor(){

        this.DEFAULT_CATEGORY = 'general';

        this.cache = {};
        this.loadStaging = [];

        this.createDefaultCategory();


    }

    createDefaultCategory(){

        this.cache[this.DEFAULT_CATEGORY] = {};

    }

    /**
     * This adds a resource and its respective loader into the staging to be loaded later
     * 
     * @param {Function} resourceLoader  Function to load the resource (required)
     * @param {String} resourceUrl  URL of the resource (required)
     * @param {String} resourceName unique name of resource (required)
     * @param {String} resourceCategory  Resource category (optional)
     * @returns {Bool}
     * 
     * @memberof ResourceCache
     */
    stageForLoading(resourceLoader, resourceUrl, resourceName, resourceCategory){

        if(!resourceLoader || !resourceUrl || !resourceName) return false;

        if(typeof resourceLoader !== 'function') return false;
        if(typeof resourceUrl !== 'string') return false;
        if(typeof resourceName !== 'string') return false;

        resourceCategory = (!resourceCategory || typeof resourceCategory !== 'string') ? this.DEFAULT_CATEGORY : resourceCategory.toLowerCase();

        //check for unique resource url
        let urlIndex = this.loadStaging.findIndex( obj =>obj.resourceUrl === resourceUrl);
        
        //if the url already exists then throw an error
        if(urlIndex !== -1) throw Error(`Resource URL "${resourceUrl}" already exists`);

        //equally check for unique resource names in the same category;
        resourceName = resourceName.toLowerCase();
        let nameIndex = this.loadStaging.findIndex( obj => obj.resourceName === resourceName && obj.resourceCategory === resourceCategory);
        
        //if the name already exits throw an error
        if(nameIndex !== -1) throw Error(`Resource name "${resourceName}" already exists in categroy {${resourceCategory}}`);



        this.loadStaging.push({resourceLoader, resourceUrl, resourceName, resourceCategory});


        return true;

    }

    /**
     * Load the resources that have been staged
     * 
     * @param {Function} onCompleted callback function to be called when loading has been completed (requried)
     * @param {Function} onProgress callback function to be called showing progress of the loading (optional)
     * 
     * @memberof ResourceCache
     */
    loadResources(onCompleted, onProgress){

        let resourceCount = this.loadStaging.length;
        let totalResourceProgress = 0;
        let progressAccumulator = 0;
        let progressAccumulatorStep = 100;
        
        //if the onProgress call back is null then create one
        if(!onProgress){
            onProgress = (currentResourceProgress, totalResourceProgress, resourceUrl)=>{
                console.log(`${totalResourceProgress}% completed: Loading ${resourceUrl} at ${currentResourceProgress}% `);
            }
        }


        //create wrapper function to be passed to async
        let functs = this.loadStaging.map(obj=>{

                return (cb)=>{

                    obj.resourceLoader( 
                            obj.resourceUrl, 
                            (...args)=>{

                                if(this.cache[obj.resourceCategory] === undefined) this.cache[obj.resourceCategory] = {};

                                //since we do not know the number of parameters that will be passed we simply stores all the
                                //passed arguments as an array. But when the resource is to be retrieved by name the first element of
                                //the array is returned;
                                this.cache[obj.resourceCategory][obj.resourceName] = [...args];
                                
                                //Update the load progress accumulator
                                progressAccumulator += progressAccumulatorStep;

                                console.log(progressAccumulator);

                                cb(null);

                            }, 
                            (xhr)=>{
                                
                                //Get the current resource loading progress in percentage
                                let currentResourceProgress = xhr.loaded / xhr.total * 100;

                                //Get the total resource loading progress in percentage
                                totalResourceProgress = (progressAccumulator + currentResourceProgress) / resourceCount;

                                onProgress(currentResourceProgress, totalResourceProgress, obj.resourceUrl);

                            },
                            (err)=>{

                                console.log(`ERROR: Failed to load "${obj.resourceName}" of category "${obj.resourceCategory}"`);
                                console.log(`ERROR: URL "${obj.resourceUrl}"`);
                                cb(err);

                            }
                    )
                }
            }
        );

        //execute the created wrapper functions serially
        series(functs, (err)=>{
            
            onCompleted(err);
            
        })

    }

    /**
     * Retrieves the resource from the cache based on the supplied name
     * 
     * @param {String} resourceName the name of the resource to retrieve (required)
     * @param {String} resourceCategory the name of the resource category of the interested resource  (optional)
     * @returns {Bool}
     * 
     * @memberof ResourceCache
     */
    getResource(resourceName, resourceCategory){

        if(typeof resourceName !== 'string') return null
        resourceName = resourceName.toLowerCase();

        resourceCategory = (!resourceCategory || typeof resourceCategory !== 'string') ? this.DEFAULT_CATEGORY : resourceCategory.toLowerCase();
        
        return this.cache[resourceCategory][resourceName][0];

    }

    /**
     * Retrieves the resource from the cache by indexing the resource array of the supplied name
     * 
     * @param {String} resourceName Name of the resource to be retrieved (required)
     * @param {String} resourceIndex Index of the resource to be retrieved (required)
     * @param {String} resourceCategory Category of resource if any. Defaults to "general"
     * @returns {Resource}
     * 
     * @memberof ResourceCache
     */
    getResourceByIndex(resourceName, resourceIndex, resourceCategory){

        if(typeof resourceName !== 'string') return null;
        if(typeof resourceIndex !== 'number') return null;

        resourceCategory = (!resourceCategory || typeof resourceCategory !== 'string') ? this.DEFAULT_CATEGORY : resourceCategory.toLowerCase();

        resourceName = resourceName.toLowerCase();

        return this.cache[resourceCategory][resourceName][resourceIndex];
    }

}

const rc = new ResourceCache();

export default rc