// Script to delete custom field "מ.א" from all personnel in company "מסייעת 1871"
// Run this in the browser console on the Personnel page

(async function deleteCustomFieldFromCompany() {
    const COMPANY_NAME = "מסייעת 1871";
    const FIELD_KEY_TO_DELETE = "cf_מא"; // or "cf_ma" - check which one it is

    console.log(`🔍 Starting cleanup for company: ${COMPANY_NAME}`);
    console.log(`🗑️  Deleting custom field: ${FIELD_KEY_TO_DELETE}`);

    try {
        // Get all personnel
        const response = await fetch('/api/personnel');
        const allPeople = await response.json();

        // Filter people from the specific company
        const peopleInCompany = allPeople.filter(person =>
            person.company === COMPANY_NAME ||
            person.teamName === COMPANY_NAME
        );

        console.log(`📊 Found ${peopleInCompany.length} people in ${COMPANY_NAME}`);

        // Filter only those who have this custom field
        const peopleWithField = peopleInCompany.filter(person =>
            person.customFields && person.customFields[FIELD_KEY_TO_DELETE]
        );

        console.log(`🎯 Found ${peopleWithField.length} people with the field "${FIELD_KEY_TO_DELETE}"`);

        if (peopleWithField.length === 0) {
            console.log('✅ No people found with this field. Nothing to delete.');
            return;
        }

        // Confirm before proceeding
        const confirmed = confirm(
            `⚠️ About to delete custom field "${FIELD_KEY_TO_DELETE}" from ${peopleWithField.length} people in ${COMPANY_NAME}.\n\n` +
            `This action cannot be undone. Continue?`
        );

        if (!confirmed) {
            console.log('❌ Operation cancelled by user');
            return;
        }

        // Delete the field from each person
        let successCount = 0;
        let errorCount = 0;

        for (const person of peopleWithField) {
            try {
                // Create updated custom fields object without the field
                const updatedCustomFields = { ...person.customFields };
                delete updatedCustomFields[FIELD_KEY_TO_DELETE];

                // Update the person
                const updateResponse = await fetch(`/api/personnel/${person.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        customFields: updatedCustomFields
                    })
                });

                if (updateResponse.ok) {
                    successCount++;
                    console.log(`✅ Deleted field from: ${person.name} (${successCount}/${peopleWithField.length})`);
                } else {
                    errorCount++;
                    console.error(`❌ Failed to update: ${person.name}`, await updateResponse.text());
                }

                // Small delay to avoid overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                errorCount++;
                console.error(`❌ Error updating ${person.name}:`, error);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`✅ Successfully deleted: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📝 Total processed: ${peopleWithField.length}`);

        if (successCount > 0) {
            console.log('\n🔄 Please refresh the page to see the changes.');
            alert(`✅ Successfully deleted custom field from ${successCount} people!\n\nPlease refresh the page.`);
        }

    } catch (error) {
        console.error('❌ Fatal error:', error);
        alert('❌ An error occurred. Check the console for details.');
    }
})();
